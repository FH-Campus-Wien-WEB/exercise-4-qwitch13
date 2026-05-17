const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const config = require("./config.js");
const movieModel = require("./movie-model.js");
const userModel = require("./user-model.js");

const app = express();

/* template */
// Parse JSON request bodies for form submissions and API calls
app.use(bodyParser.json());

// Configure express-session middleware for user authentication
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true only when using https
}));

// Serve static HTML, CSS, JavaScript, and image files from the 'files' directory
app.use(express.static(path.join(__dirname, "files")));
/* template */

/* START - Task 1.3: Middleware function that enforces authentication.
   This gate function checks whether a valid session exists before allowing
   protected handlers to run. If the session is missing or invalid, returns 401 Unauthorized.
*/
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.sendStatus(401);
}
/* END - Task 1.3 */

/* START - Task 1.1: POST /login endpoint
   Public endpoint that accepts username and password, verifies them against bcrypt-hashed
   credentials in the user model, and returns the session user object on success (201).
   Returns 401 Unauthorized if credentials don't match.
*/
app.post("/login", function (req, res) {
  const { username, password } = req.body;
  const user = userModel[username];
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = {
      username,
      firstName: user.firstName,
      lastName: user.lastName,
      loginTime: new Date().toISOString(),
    };
    res.send(req.session.user);
  } else {
    res.sendStatus(401);
  }
});
/* END - Task 1.1 */

/* START - Task 1.3: GET /logout endpoint
   Destroys the express-session session and clears the session cookie.
   Returns 200 OK on success, 500 Internal Server Error on failure.
*/
app.get("/logout", function (req, res) {
  if (!req.session) {
    return res.sendStatus(200);
  }
  req.session.destroy(function (err) {
    if (err) {
      console.error("Failed to destroy session:", err);
      return res.sendStatus(500);
    }
    res.clearCookie("connect.sid");
    res.sendStatus(200);
  });
});
/* END - Task 1.3 */

/* START - Task 1.1: GET /session endpoint
   Public endpoint that checks whether a valid session exists and returns the session user object
   (username, firstName, lastName, loginTime) if logged in. Returns 401 with null if not authenticated.
*/
app.get("/session", function (req, res) {
  if (req.session.user) {
    res.send(req.session.user);
  } else {
    res.status(401).json(null);
  }
});
/* END - Task 1.1 */

/* START - Task 1.2: GET /movies endpoint
   Protected endpoint that returns movies for the authenticated user.
   Supports optional ?genre= query parameter to filter by genre.
*/
app.get("/movies", requireLogin, function (req, res) {
  const username = req.session.user.username;
  let movies = Object.values(movieModel.getUserMovies(username));
  const queriedGenre = req.query.genre;
  if (queriedGenre) {
    movies = movies.filter((movie) => movie.Genres.indexOf(queriedGenre) >= 0);
  }
  res.send(movies);
});
/* END - Task 1.2 */

app.get("/movies/:imdbID", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const id = req.params.imdbID;
  const movie = movieModel.getUserMovie(username, id);

  if (movie) {
    res.send(movie);
  } else {
    res.sendStatus(404);
  }
});

/* START - Task 2.3: Helper function to convert OMDb API response to internal movie format.
   Reshapes OMDb's full-detail record (with comma-separated lists and OMDB-specific formats)
   into the internal movie object shape. Parses dates, converts string lists to arrays,
   and normalizes missing/invalid values.
*/
function convertOmdbMovie(omdb) {
  const runtimeNum = parseInt(omdb.Runtime, 10);
  const metaNum = parseInt(omdb.Metascore, 10);
  const ratingNum = parseFloat(omdb.imdbRating);

  // omdb returns "Released" as e.g. "15 Sep 2005"; reshape to iso-8601 date.
  // append " UTC" so the local timezone can't shift the date by a day.
  let released = omdb.Released;
  if (released && released !== "N/A") {
    const parsed = new Date(`${released} UTC`);
    if (!isNaN(parsed.getTime())) {
      released = parsed.toISOString().slice(0, 10);
    }
  } else {
    released = null;
  }

  // omdb returns comma-separated lists for these — split them into arrays
  const toArray = (value) =>
    value && value !== "N/A"
      ? value.split(",").map((item) => item.trim())
      : [];

  return {
    imdbID: omdb.imdbID,
    Title: omdb.Title,
    Released: released,
    Runtime: isNaN(runtimeNum) ? null : runtimeNum,
    Genres: toArray(omdb.Genre),
    Directors: toArray(omdb.Director),
    Writers: toArray(omdb.Writer),
    Actors: toArray(omdb.Actors),
    Plot: omdb.Plot && omdb.Plot !== "N/A" ? omdb.Plot : "",
    Poster: omdb.Poster && omdb.Poster !== "N/A" ? omdb.Poster : "",
    Metascore: isNaN(metaNum) ? null : metaNum,
    imdbRating: isNaN(ratingNum) ? null : ratingNum,
  };
}
/* END - Task 2.3 */

/* START - Task 2.3: PUT /movies/:imdbID endpoint
   Upsert operation: if the movie already belongs to the user, returns 200 (no fetch).
   Otherwise, fetches full OMDb data using the imdbID, converts it to internal format,
   saves it to the user's collection, and returns 201 Created with the movie object.
*/
app.put("/movies/:imdbID", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const imdbID = req.params.imdbID;
  const exists = movieModel.hasUserMovie(username, imdbID);

  if (exists) {
    movieModel.setUserMovie(username, imdbID, req.body);
    return res.sendStatus(200);
  }

  // Same promise-based pattern as GET /search: fetch from OMDb API with timeout
  const url = `http://www.omdbapi.com/?i=${encodeURIComponent(imdbID)}&apikey=${config.omdbApiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.omdbTimeoutMs);

  fetch(url, { signal: controller.signal })
    .then((apiRes) => {
      clearTimeout(timeoutId);
      if (!apiRes.ok) {
        return res.sendStatus(apiRes.status);
      }
      return apiRes.text().then((data) => {
        let response;
        try {
          response = JSON.parse(data);
        } catch (parseError) {
          console.error("Failed to parse OMDb response:", parseError);
          return res.sendStatus(500);
        }

        if (response.Response !== "True") {
          // omdb returned a logical error (e.g. "Movie not found!")
          return res.sendStatus(404);
        }

        const movie = convertOmdbMovie(response);
        movieModel.setUserMovie(username, imdbID, movie);
        res.status(201).send(movie);
      });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        console.error("OMDb API request timeout");
        return res.sendStatus(504);
      }
      console.error("OMDb API error:", err);
      res.sendStatus(500);
    });
});
/* END - Task 2.3 */

app.delete("/movies/:imdbID", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const id = req.params.imdbID;
  if (movieModel.deleteUserMovie(username, id)) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

/* START - Task 1.2: GET /genres endpoint
   Protected endpoint that returns a sorted list of all unique genres from the
   user's movie collection.
*/
app.get("/genres", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const genres = movieModel.getGenres(username);
  genres.sort();
  res.send(genres);
});
/* END - Task 1.2 */

/* START - Task 2.1: GET /search endpoint
   Protected endpoint that searches OMDb API by movie title (query parameter).
   Returns simplified results (Title, imdbID, Year), excluding movies the user already owns.
   Includes timeout and error handling.
*/
app.get("/search", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const query = req.query.query;
  if (!query) {
    return res.sendStatus(400);
  }

  const url = `http://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${config.omdbApiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.omdbTimeoutMs);

  fetch(url, { signal: controller.signal })
    .then((apiRes) => {
      clearTimeout(timeoutId);
      if (!apiRes.ok) {
        return res.sendStatus(apiRes.status);
      }
      return apiRes.text().then((data) => {
        let response;
        try {
          response = JSON.parse(data);
        } catch (parseError) {
          console.error("Failed to parse OMDb response:", parseError);
          return res.sendStatus(500);
        }

        if (response.Response === "True") {
          const results = response.Search
            .filter((movie) => !movieModel.hasUserMovie(username, movie.imdbID))
            .map((movie) => ({
              Title: movie.Title,
              imdbID: movie.imdbID,
              Year: isNaN(movie.Year) ? null : parseInt(movie.Year)
            }));
          res.send(results);
        } else {
          res.send([]);
        }
      });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        console.error("OMDb API request timeout");
        return res.sendStatus(504);
      }
      console.error("OMDb API error:", err);
      res.sendStatus(500);
    });
});
/* END - Task 2.1 */

/* template */
app.listen(config.port);

console.log(`Server now listening on http://localhost:${config.port}/`);
/* template */

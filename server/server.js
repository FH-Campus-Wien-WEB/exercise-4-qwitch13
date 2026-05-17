const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const config = require("./config.js");
const movieModel = require("./movie-model.js");
const userModel = require("./user-model.js");

const app = express();

// parse json bodies
app.use(bodyParser.json());

// session middleware
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true only when using https
}));

// serve static client from /files
app.use(express.static(path.join(__dirname, "files")));

// task 1.3: gate function — checks session before letting protected handlers run
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.sendStatus(401);
}

// public: login
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

// task 1.3: logout — destroy the session and answer 200, or 500 on error
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

// public: session probe
app.get("/session", function (req, res) {
  if (req.session.user) {
    res.send(req.session.user);
  } else {
    res.status(401).json(null);
  }
});

// all endpoints below need a session
app.get("/movies", requireLogin, function (req, res) {
  const username = req.session.user.username;
  let movies = Object.values(movieModel.getUserMovies(username));
  const queriedGenre = req.query.genre;
  if (queriedGenre) {
    movies = movies.filter((movie) => movie.Genres.indexOf(queriedGenre) >= 0);
  }
  res.send(movies);
});

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

// task 2.3: converts an OMDb full-detail record to the internal movie shape
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

// upsert: if the movie already belongs to the user, treat as update (200);
// otherwise fetch full data from omdb, convert, save, return 201
app.put("/movies/:imdbID", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const imdbID = req.params.imdbID;
  const exists = movieModel.hasUserMovie(username, imdbID);

  if (exists) {
    movieModel.setUserMovie(username, imdbID, req.body);
    return res.sendStatus(200);
  }

  // task 2.3: same promise-based pattern as GET /search
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

app.delete("/movies/:imdbID", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const id = req.params.imdbID;
  if (movieModel.deleteUserMovie(username, id)) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.get("/genres", requireLogin, function (req, res) {
  const username = req.session.user.username;
  const genres = movieModel.getGenres(username);
  genres.sort();
  res.send(genres);
});

// search omdb by title — already a working reference implementation
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

app.listen(config.port);

console.log(`Server now listening on http://localhost:${config.port}/`);

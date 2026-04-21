[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/t9h-SO6U)
# Web Technologies - Exercise 4

The fourth and last assignment is about movie management with user authentication. Users must log in to access all features of the application, including searching for movies using the `https://www.omdbapi.com/` API, adding them to their personal movie collection, and removing movies from their collection. This exercise focuses on implementing secure authentication and ensuring that all movie management features are protected behind a login requirement.

As usual, you find detailed information about each part in the **Tasks** section below.

To set up your working environment for the project, you will have to perform the same steps you already use since exercise 1. First, you **clone** the project and configure it in an IDE, then you **install** the project's dependencies. To do so, run 

    npm install

in the project's root directory, where this `README.md` file is located. 

Use 

    npm start

or using `nodemon` (the **recommended** option)

    npm run start-nodemon

to start the server. In any case the server will be running on port 3000. You should see the message

    Server now listening on http://localhost:3000/

in your terminal. Navigate to [http://localhost:3000/](http://localhost:3000/) to test the application manually.

## Project structure

Our starting point for exercise 4 is a solution of exercise 3, but with modifications for authentication and simplified search.

On the server-side, we now have our `movie-model.js` and `user-model.js` which handle data persistence. The actual data is stored in `movies.json` and `users.json` files. This means that all application data persists across server restarts. The `movie-model.js` provides functions to load, save, and modify movies, while `user-model.js` provides read-only access to user credentials (user management functionality is not yet implemented).

**Important:** The structure of `movies.json` has changed. Movies are now stored per user, allowing each user to have their own movie collection. 

In `server.js` you will find the server startup code defining the endpoints we have so far, plus new ones for authentication and search:
* `POST /login` to authenticate users and create a session,
* `GET /session` to check the current session status (returns user object if logged in),
* `GET /movies` to get either all or genre-specific movies using the query parameter `genre` (requires login),
* `GET /movies/:imdbID` to get a specific movie to be edited in our form (requires login),
* `PUT /movies/:imdbID` to update a movie (requires login),
* `DELETE /movies/:imdbID` to remove a movie from the collection (requires login),
* `GET /genres` to get all genres of the movies in the collection sorted alphabetically (requires login),
* `GET /search` to search for movies using OMDb API (requires login).

On the client-side, we have `index.html` and `edit.html`. We are going to use dialogs for login and search directly in `index.html` this time instead of adding a new `html` file. The login- and add-movie- functionality are integrated into a dialog overlay on the main page. One of these dialogs already exists, the second one will be implemented by you.

Two of the CSS files, `index.css` and `edit.css` extend `base.css` for basic styling. The `index.css` file additionally imports `layout.css`, which defines the main page's layout.

In `builders.js` all element builders reside, which are used in `index.js`. You can use the builders to build the elements of this exercise, if you wish to do so. If you want to read more about the builder pattern itself, you can start with its [wikipedia page](https://en.wikipedia.org/wiki/Builder_pattern). 

Before starting the exercise, take time to study the existing code to understand how the authentication and movie management aspects work together and how data is organized and managed.

## New Concepts Introduced in This Exercise

This exercise introduces several new concepts that are important to fully understand the code. Here you find an introductory explanation for all of them.

### 1. The .env file and its use for configuration

In previous exercises, configuration values like the server port were hardcoded in the code. In real-world applications, it's important to keep sensitive information (like API keys) and environment-specific settings (like ports) separate from the code. This is done using environment variables.

A `.env` file is a text file that contains key-value pairs of environment variables. For example:

```
PORT=3000
OMDB_API_KEY=your-api-key-here
SESSION_SECRET=your-secret-key
```

To use these variables in your Node.js application, you install the `dotenv` package (already in your `package.json`) and load the `.env` file at the start of your application. The variables become available in `process.env`. You should never commit the `.env` file to version control, as it may contain sensitive information.

You will need to request your own OMDbAPI key and add it to the `.env` file to be able to test movie management. Also, find out what a good session secret looks like and define one.

### 2. Session management using express-session

Web applications are stateless by default - each HTTP request is independent. However, for user authentication, we need to maintain state across requests. Sessions solve this problem.

When a user logs in, the server creates a session and stores user information on the server-side. The server sends a session ID to the client, usually as a cookie. On subsequent requests, the client sends this session ID back, allowing the server to identify the user.

The `express-session` middleware handles this automatically. You configure it with a secret key (used to sign the session ID cookie) and options. The session data is stored in memory by default.

Key concepts:
- **Session lifecycle**: Created on login, destroyed on logout or timeout.
- **Gate function (middleware)**: A function that checks if a user is logged in before allowing access to protected endpoints. It calls `next()` to continue the request chain if authenticated, or sends a 401 status if not.
- **Server-side storage**: Session data is stored on the server, not in the cookie. The cookie only contains the session ID.
- **Client-side**: The browser automatically sends the session cookie with each request to the same domain.

For more details, refer to the official [express-session documentation](https://www.npmjs.com/package/express-session). Most of the session management is already present in your code, you will add some aspects in tasks 1.1 to 1.3.

### 3. Data persistence in files using models

In this exercise, data is persisted in JSON files instead of being lost on server restart. `movie-model.js`provides functions to read from and write to the file, `user-model.js` provides functions to read the data (there is no user management yet!).

The movie model stores movies per user, allowing each user to have their own collection. Functions include getting all movies for a user, getting a specific movie, setting (adding/updating) a movie, deleting a movie, and getting genres.

### 4. Accessing the OMDb API using the Fetch API

To search for movies, we use the OMDbAPI (https://www.omdbapi.com/). This is accessed using the Fetch API, a modern, promise-based replacement for XMLHttpRequest.

The Fetch API uses promises instead of callbacks, making asynchronous code easier to write and read. A basic fetch request looks like:

```javascript
fetch(url)
  .then(response => response.json())
  .then(data => {
    // handle data
  })
  .catch(error => {
    // handle error
  });
```

This is an alternative to the AJAX programming pattern you used in previous exercises with `XMLHttpRequest` and callbacks. All client-side AJAX has been migrated to Fetch API.

For more information, see the [MDN Fetch API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

### 5. Client-side dialogs

Modern web applications often use modal dialogs for user interactions like login forms or search interfaces. HTML provides the `<dialog>` element for this purpose.

A dialog is shown using `dialog.showModal()` and closed with `dialog.close()`. Dialogs can contain forms, and form submission can be handled with event listeners.

In this exercise, we use two dialogs, one for login and one for searching and adding movies. You will find one already implemented and will need to add the other one on your own.

## Tasks

This exercise is divided into two main task groups, each containing three subtasks. We cover **User Management** first and then move on to **Movie Management**.

### Task 1: Session Management

**1.1. Login request and error handling (Client)**  
In `index.js`, implement the request to `POST /login` from the login form. The body must include `username` and `password` from the form. Handle error cases such as invalid credentials. On success, store the server response in `currentSession`, then call `updateUI()` and `loadMovies()`.

**1.2. Render login greeting (Client)**  
Also in `index.js`, render a user greeting in the element with `id="userGreeting"`. The greeting must include the `firstName`, `lastName`, and the login date/time returned by the server. Example: `Hi Joe Doe, du hast dich am 19. April 2026 um 21:15 angemeldet.`

**1.3. Session logout and endpoint protection (Server)**  
On the serverside, implement `GET /logout` to destroy the session and return the appropriate response. Create a `requireLogin` middleware function that checks whether a session exists and apply it to all endpoints that require authentication.

### Task 2: Movie Management

**2.1. Search dialog markup (Client)**  
Add a search dialog to `index.html` parallel to the login dialog. It must contain a text input for the search query, a submit button, and a cancel button. The element IDs must match the client-side code that opens the dialog.

**2.2. Search results and add button logic (Client)**  
Implement search rendering in `searchMovies()` in `index.js`. Display returned movies with `Title` and `Year` and add an `Add` button for each result. The `Add` button must call `addMovie(imdbID)`. If no movies are found, show a proper message. When a movie is added successfully, remove that entry from the dialog results.

**2.3. Fetch OMDb movie data and save it (Server)**  
In `server.js`, implement the `/movies/:imdbID` addition flow by fetching full movie data from OMDb, converting it into the internal format used by the movie model, and saving it for the current user. Use the same promise-based pattern already used by `GET /search`.

### Task 1.1: Login request and error handling

**Client-side (`server/files/index.js`):**  
Implement the login form submission code to call `POST /login`. Send a JSON body with `username` and `password` from the form. Add error handling for non-OK responses. On success, save the response as `currentSession`, close the login dialog, call `updateUI()`, and then `loadMovies()`.

### Task 1.2: Render login greeting

**Client-side (`server/files/index.js`):**  
Implement `renderUserGreeting()` so it updates the `#userGreeting` element. When `currentSession` exists, show the user's first and last name and the login timestamp in the requested German-style sentence.

### Task 1.3: Session logout and endpoint protection

**Server-side (`server/server.js`):**  
Implement `GET /logout` so it destroys the session and sends `200` on success or `500` on error. Add a `requireLogin` middleware function that checks `req.session.user` and returns `401` if missing. Use this middleware for all protected endpoints.

### Task 2.1: Search dialog markup

**Client-side (`server/files/index.html`):**  
Add the search dialog markup with `id="searchDialog"`, `id="searchForm"`, `id="query"`, and `id="searchResults"`. Add a submit button and a cancel button. The dialog should be placed alongside the login dialog.

### Task 2.2: Search results and add button logic

**Client-side (`server/files/index.js`):**  
Implement `searchMovies(query)` to render search results from the server. For each movie returned, show `Title` and `Year`, and add an `Add` button that calls `addMovie(movie.imdbID)`. Handle the empty-results case with a clear message. Remove the added movie entry from the dialog when `addMovie()` succeeds.

### Task 2.3: Fetch OMDb movie data and save it

**Server-side (`server/server.js`):**  
Implement the add-movie flow by calling OMDb with the selected `imdbID`, converting the response to the internal movie format, and saving it in the movie model for the current user. Use the same promise-based fetch pattern already used in `GET /search`.

---

These tasks are designed so that students manually implement the client and server code in a logical sequence. The first group adds login/session behavior, the second group adds movie search and save behavior.

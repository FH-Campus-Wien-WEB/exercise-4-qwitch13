/* template */
import { ButtonBuilder, ElementBuilder, MovieBuilder } from "./builders.js";

// Externalized message strings
const messages = {
  dataLoadError: 'Daten konnten nicht geladen werden, Status',
  movieAlreadyInCollection: 'Film bereits in der Sammlung.',
  addMovieFailed: 'Hinzufügen des Films ist fehlgeschlagen.',
  deleteMovieFailed: 'Film konnte nicht gelöscht werden.',
  noResultsFound: 'Keine Ergebnisse gefunden.',
  searchFailed: 'Die Suche ist fehlgeschlagen...',
  loggedOutGreeting: 'Bitte logge dich ein, um deine Filmkollektion zu sehen.',
  loginFailed: 'Login failed'
};
/* template */

let currentSession = null;

function updateGenres() {
  const header = document.querySelector('nav>h2');
  const listElement = document.querySelector("#filter");

  listElement.innerHTML = '';

  if (!currentSession) {
    header.style.display = 'none';
    return;
  }

  fetch("/genres")
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(genres => {
      header.style.display = 'block';
      new ElementBuilder("li").append(new ButtonBuilder("All").onclick(() => loadMovies()))
        .appendTo(listElement);

      for (const genre of genres) {
        new ElementBuilder("li").append(new ButtonBuilder(genre).onclick(() => loadMovies(genre)))
          .appendTo(listElement);
      }

      const firstButton = listElement.querySelector("button");
      if (firstButton) {
        firstButton.click();
      }
    })
    .catch(error => {
      console.error('Failed to load genres:', error);
      listElement.append(`${messages.dataLoadError} ${error.message}`);
    });
}

function removeMovies() {
  const mainElement = document.querySelector("main");
  while (mainElement.childElementCount > 0) {
    mainElement.firstChild.remove();
  }
}

function loadMovies(genre) {
  const url = new URL("/movies", location.href);
  if (genre) {
    url.searchParams.set("genre", genre);
  }

  fetch(url)
    .then(response => {
      removeMovies();
      const mainElement = document.querySelector("main");

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(movies => {
      const mainElement = document.querySelector("main");
      movies.forEach(movie => new MovieBuilder(movie, deleteMovie, Boolean(currentSession)).appendTo(mainElement));
    })
    .catch(error => {
      console.error('Failed to load movies:', error);
      const mainElement = document.querySelector("main");
      mainElement.append(`${messages.dataLoadError} ${error.message}`);
    });
}

function addMovie(imdbID) {
  fetch(`/movies/${imdbID}`, { method: 'PUT' })
    .then(response => {
      if (response.status === 201) {
        /* START - Task 2.2: Remove the movie from the search results dialog
                   so the user can't accidentally add it multiple times.
                   Prevents confusion if they search for the same movie again during the session.
                */
        const entry = document.querySelector(`#searchResults [data-imdb-id="${imdbID}"]`);
        if (entry) {
          entry.remove();
        }
        /* END - Task 2.2 */
        loadMovies();
        updateGenres();
      } else if (response.status === 200) {
        alert(messages.movieAlreadyInCollection);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    })
    .catch(error => {
      console.error('Failed to add movie:', error);
      alert(messages.addMovieFailed);
    });
}

function deleteMovie(imdbID) {
  fetch(`/movies/${imdbID}`, { method: 'DELETE' })
    .then(response => {
      if (response.ok) {
        const article = document.getElementById(imdbID);
        if (article) {
          article.remove();
        }
        updateGenres();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    })
    .catch(error => {
      console.error('Failed to delete movie:', error);
      alert(messages.deleteMovieFailed);
    });
}

function searchMovies(query) {
  fetch(`/search?query=${encodeURIComponent(query)}`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(results => {
      const resultsDiv = document.getElementById("searchResults");
      resultsDiv.innerHTML = '';

      /* START - Task 2.2: Display a clear message if no search results are found.
             This improves user experience by explaining why the results area is empty.
          */
      if (!results || results.length === 0) {
        new ElementBuilder("p").text(messages.noResultsFound).appendTo(resultsDiv);
        return;
      }
      /* END - Task 2.2 */

      /* START - Task 2.2: Render each search result with title, year, and an "Add" button.
             Each result is a clickable div with the movie's basic info. Clicking "Add"
             triggers the addMovie function to fetch full details from OMDb and save to collection.
          */
      for (const movie of results) {
        new ElementBuilder("div")
          .class("search-result")
          .with("data-imdb-id", movie.imdbID)
          .append(new ElementBuilder("span").text(`${movie.Title} (${movie.Year ?? '—'})`))
          .append(new ButtonBuilder("Add").onclick(() => addMovie(movie.imdbID)))
          .appendTo(resultsDiv);
      }
      /* END - Task 2.2 */
    })
    .catch(error => {
      console.error('Search failed:', error);
      const resultsDiv = document.getElementById("searchResults");
      new ElementBuilder("p").text(messages.searchFailed).appendTo(resultsDiv);
    });
}

window.onload = function () {
  /* START - Task 1.1: Initialize the page by checking whether a session exists.
             Fetches /session to determine login state, initializes UI accordingly.
             This runs before displaying movies or any interaction.
          */
  fetch("/session")
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      currentSession = data || null;
      updateUI();
    })
    .catch(error => {
      console.error('Failed to load session:', error);
      currentSession = null;
      updateUI();
    });
  /* END - Task 1.1 */

  function renderUserGreeting() {
    const greetingElement = document.getElementById('userGreeting');
    if (currentSession) {
      /* START - Task 1.2: Display a personalized greeting message with the user's login timestamp.
                Format: "Hi [FirstName] [LastName], du hast dich am [Date] um [Time] angemeldet."
                The loginTime is in ISO format and is localized to German date/time conventions.
             */
      const loginDate = new Date(currentSession.loginTime);
      const datePart = loginDate.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const timePart = loginDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
      greetingElement.textContent =
        `Hi ${currentSession.firstName} ${currentSession.lastName}, ` +
        `du hast dich am ${datePart} um ${timePart} angemeldet.`;
      /* END - Task 1.2 */
    } else {
      greetingElement.textContent = messages.loggedOutGreeting;
    }
  }

  function updateUI() {
    const authBtn = document.getElementById('authBtn');
    const addMoviesBtn = document.getElementById('addMoviesBtn');

    renderUserGreeting();
    updateGenres();

    if (currentSession) {
      authBtn.textContent = 'Logout';
      authBtn.onclick = () => {
        fetch("/logout")
          .then(response => {
            if (response.ok) {
              currentSession = null;
              updateUI();
            }
          })
          .catch(error => {
            console.error('Logout failed:', error);
          });
      };
      addMoviesBtn.style.display = 'inline';
    } else {
      removeMovies();
      authBtn.textContent = 'Login';
      authBtn.onclick = () => {
        const loginForm = document.getElementById('loginForm');
        loginForm.reset();
        document.getElementById('loginDialog').showModal();
      };
      addMoviesBtn.style.display = 'none';
    }
  }

  /* START - Task 1.1: Login dialog handling.
             Submitting the login form sends credentials to POST /login.
             On success, updates the session and refreshes the UI; on failure, displays an error.
          */
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const credentials = {
      username: formData.get('username'),
      password: formData.get('password')
    };

    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })
      .then(response => {
        if (!response.ok) {
          // 401 lands here — surface a user-friendly message and stop the chain
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        currentSession = data;
        document.getElementById('loginDialog').close();
        updateUI();
        loadMovies();
      })
      .catch(error => {
        console.error('Login failed:', error);
        alert(messages.loginFailed);
      });
  });

  document.getElementById('cancelLogin').addEventListener('click', () => {
    document.getElementById('loginDialog').close();
  });
  /* END - Task 1.1 */

  /* START - Task 2.1: Search dialog handling.
             Opens the search dialog when user clicks "Add movies".
             Submitting the form calls searchMovies() to fetch results from GET /search.
          */
  document.getElementById('addMoviesBtn').addEventListener('click', () => {
    const searchForm = document.getElementById('searchForm');
    searchForm.reset();
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchDialog').showModal();
  });

  document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('query').value;
    searchMovies(query);
  });

  document.getElementById('cancelSearch').addEventListener('click', () => {
    document.getElementById('searchDialog').close();
  });
  /* END - Task 2.1 */
};


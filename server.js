import express from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const language = 'pl-PL';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// TheMovieDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  console.error('Error: TMDB_API_KEY must be set in environment variables');
  process.exit(1);
}

// Middleware
app.use(express.json());

// Helper function to fetch movie details from TheMovieDB
async function fetchMovieDetails(movieId) {
  try {
    // We fetch both endpoints simultaneously to save time
    const [movieResponse, creditsResponse] = await Promise.all([
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
        params: { api_key: TMDB_API_KEY, language: language }
      }),
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}/credits`, {
        params: { api_key: TMDB_API_KEY, language: language }
      })
    ]);

    // Combine the movie data with the cast array
    return {
      ...movieResponse.data,
      cast: creditsResponse.data.cast,
      crew: creditsResponse.data.crew // Optional: includes directors, writers, etc.
    };
  } catch (error) {
    console.error("Error fetching movie details:", error);
    throw error;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'FilmleAPI is running' });
});

// Mystery movie endpoint
app.get('/api/mystery_movie', async (req, res) => {
  try {
    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Query Supabase for movie ID and all other fields based on current date
    const { data, error } = await supabase
      .from('calendar')
      .select('*')
      .eq('date', currentDate)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ 
        error: 'Database error',
        details: error.message 
      });
    }

    if (!data || !data.movie) {
      return res.status(404).json({ 
        error: 'No movie found for today' 
      });
    }

    const movieId = data.movie;

    // Fetch movie details from TheMovieDB API
    const movieDetails = await fetchMovieDetails(movieId);

    // Return the movie data along with all Supabase fields
    res.json({
      date: currentDate,
      quote_en: data.quote_en,
      quote_pl: data.quote_pl,
      description: data.description,
      movie: movieDetails
    });

  } catch (error) {
    if (error.response) {
      // TheMovieDB API error
      return res.status(error.response.status).json({
        error: 'Failed to fetch movie from TheMovieDB',
        details: error.response.data?.status_message || error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.query;

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required',
        example: '/search?query=batman'
      });
    }

    // Search for movies in TheMovieDB API
    const tmdbResponse = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        language: language
      }
    });

    // Return the search results
    res.json({
      query: query,
      results: tmdbResponse.data.results,
      total_results: tmdbResponse.data.total_results,
      page: tmdbResponse.data.page,
      total_pages: tmdbResponse.data.total_pages
    });

  } catch (error) {
    if (error.response) {
      // TheMovieDB API error
      return res.status(error.response.status).json({
        error: 'Failed to search movies from TheMovieDB',
        details: error.response.data?.status_message || error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Movie details endpoint
app.get('/api/movie/:movie_id', async (req, res) => {
  try {
    const movieId = req.params.movie_id;

    if (!movieId) {
      return res.status(400).json({
        error: 'Movie ID is required',
        example: '/movie/550'
      });
    }

    // Fetch movie details from TheMovieDB API
    const movieDetails = await fetchMovieDetails(movieId);

    // Return the movie data
    res.json({
      movie: movieDetails
    });

  } catch (error) {
    if (error.response) {
      // TheMovieDB API error
      return res.status(error.response.status).json({
        error: 'Failed to fetch movie from TheMovieDB',
        details: error.response.data?.status_message || error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


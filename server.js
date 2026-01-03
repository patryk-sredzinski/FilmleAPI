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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'FilmleAPI is running' });
});

// Mystery movie endpoint
app.get('/mystery_movie', async (req, res) => {
  try {
    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Query Supabase for movie ID based on current date
    const { data, error } = await supabase
      .from('calendar')
      .select('movie')
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
    const tmdbResponse = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US'
      }
    });

    // Return the movie data
    res.json({
      date: currentDate,
      movie: tmdbResponse.data
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


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

// Test endpoint to check Supabase connection and table access
app.get('/test-db', async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from('calendar')
      .select('*', { count: 'exact' })
      .limit(5);
    
    res.json({
      connected: true,
      error: error?.message || null,
      rowCount: count,
      sampleData: data,
      tableName: 'calendar'
    });
  } catch (err) {
    res.status(500).json({
      connected: false,
      error: err.message
    });
  }
});

// Mystery movie endpoint
app.get('/mystery_movie', async (req, res) => {
  try {
    // Get current date in YYYY-MM-DD format
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    console.log('Querying for date:', currentDate);
    
    // Query Supabase for movie_id based on current date
    // Try multiple approaches since date columns can be stored differently
    // Also try different table name variations
    let { data, error } = await supabase
      .from('calendar')
      .select('*')
      .eq('date', currentDate)
      .maybeSingle();
    
    // If that fails, try 'Calendar' (capitalized)
    if (error && (error.message?.includes('relation') || error.message?.includes('does not exist'))) {
      const { data: data2, error: error2 } = await supabase
        .from('Calendar')
        .select('*')
        .eq('date', currentDate)
        .maybeSingle();
      if (!error2) {
        data = data2;
        error = null;
      }
    }

    // If no result, try querying all and filtering manually (in case date is stored as timestamp)
    if (!data && !error) {
      const { data: allData, error: allError } = await supabase
        .from('calendar')
        .select('*');
      
      if (allError) {
        console.error('Error fetching all calendar entries:', allError);
        return res.status(500).json({ 
          error: 'Database error',
          details: allError?.message || 'Unknown error'
        });
      }
      
      console.log('All calendar entries:', allData);
      console.log('Looking for date:', currentDate);
      
      // Try to find a match - date might be stored as string, date, or timestamp
      if (allData && allData.length > 0) {
        data = allData.find(entry => {
          const entryDate = entry.date;
          if (!entryDate) return false;
          
          // Convert to string for comparison
          const entryDateStr = typeof entryDate === 'string' 
            ? entryDate.split('T')[0]  // Handle ISO strings
            : new Date(entryDate).toISOString().split('T')[0];
          
          return entryDateStr === currentDate;
        });
        
        if (data) {
          console.log('Found matching entry:', data);
        } else {
          console.log('No matching entry found. Available dates:', allData.map(e => e.date));
        }
      }
    }

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Database error',
        details: error?.message || 'Unknown error'
      });
    }

    if (!data) {
      // Get all entries for debugging
      const { data: allData } = await supabase
        .from('calendar')
        .select('*')
        .limit(10);
      
      return res.status(404).json({ 
        error: 'No movie found for today',
        searchedDate: currentDate,
        debug: {
          totalEntries: allData?.length || 0,
          sampleEntries: allData?.slice(0, 3) || [],
          entryDates: allData?.map(e => ({ date: e.date, type: typeof e.date })) || []
        }
      });
    }

    // Try different possible column names
    const movieId = data.movie_id || data.movieId || data.movieid || data.movie;
    
    if (!movieId) {
      console.error('Available data fields:', Object.keys(data));
      return res.status(500).json({ 
        error: 'Movie ID column not found',
        availableFields: Object.keys(data)
      });
    }

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
    console.error('Error fetching mystery movie:', error);
    
    if (error.response) {
      // TheMovieDB API error
      return res.status(error.response.status).json({
        error: 'Failed to fetch movie from TheMovieDB',
        details: error.response.data?.status_message || error?.message || 'Unknown error'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


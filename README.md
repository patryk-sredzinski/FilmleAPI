# FilmleAPI

A Node.js API that fetches mystery movies from Supabase and retrieves movie details from TheMovieDB API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TMDB_API_KEY=your_tmdb_api_key
PORT=3000
```

3. Get your Supabase credentials:
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy the Project URL and anon/public key

4. Get your TheMovieDB API key:
   - Sign up at https://www.themoviedb.org/
   - Go to Settings > API
   - Request an API key
   - Copy your API key

## Running the Server

Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:3000` (or the PORT specified in your `.env` file).

## API Endpoints

### GET /mystery_movie

Fetches the mystery movie for the current date.

**Response:**
```json
{
  "date": "2024-01-15",
  "movie": {
    "id": 123,
    "title": "Movie Title",
    "overview": "Movie description...",
    ...
  }
}
```

**Error Responses:**
- `404`: No movie found for today in the calendar table
- `500`: Internal server error

## Database Schema

The Supabase `calendar` table should have the following structure:
- `id` (primary key)
- `date` (date type, format: YYYY-MM-DD)
- `movie_id` (integer, TheMovieDB movie ID)










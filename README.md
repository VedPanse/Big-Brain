# 🧠 Big Brain - AI-Powered Quiz Generation & Tracking

A modern quiz generation and tracking feature built with React + Vite (frontend) and FastAPI (backend) using OpenAI for intelligent quiz generation.

## Architecture

- **Frontend**: React + Vite (JavaScript)
- **Backend**: FastAPI with SQLite
- **AI**: OpenAI GPT-4 for quiz generation
- **Data Storage**: SQLite database for quiz attempts
- **API**: RESTful endpoints with CORS support

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm
- OpenAI API Key

### Environment Setup

1. Create a `.env` file in the project root:
   ```bash
   # Copy the example
   cp .env.example .env
   
   # Edit and add your OpenAI API key
   OPENAI_API_KEY=your_openai_api_key_here
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a Python virtual environment:
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   ```bash
   # On macOS/Linux
   source .venv/bin/activate
   
   # On Windows
   .venv\Scripts\activate
   ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Start the backend server:
   ```bash
   uvicorn main:app --reload
   ```
   
   The API will be available at `http://localhost:8000`
   - Health check: `http://localhost:8000/health`
   - API docs: `http://localhost:8000/docs`

### Frontend Setup

1. From the project root, install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

## Features

### AI-Powered Quiz Generation
- **OpenAI Integration**: Uses GPT-4o-mini for intelligent question generation
- **Customizable Parameters**: Topic, difficulty level, number of questions
- **Multiple Choice Format**: Clean, standardized MCQ format with 4 choices
- **Context Aware**: Optional user context for more tailored questions
- **Educational Explanations**: Each question includes a detailed explanation

### Quiz Taking
- **Progressive UI**: One question at a time with progress tracking
- **Navigation**: Move between questions freely
- **Response Capture**: Collect responses with timestamps

### Results & Scoring
- **Instant Scoring**: Automatic scoring after submission
- **Detailed Breakdown**: Per-question correctness analysis
- **Explanations**: Educational explanations for each question
- **Score History**: Track all previous attempts

### History & Analytics
- **Attempt Storage**: All attempts saved to SQLite database
- **History View**: Browse previous quiz attempts
- **Performance Tracking**: View scores and timestamps

## API Endpoints

### 1. Generate Quiz
```
POST /api/quizzes/generate
Content-Type: application/json

{
  "topic": "Machine Learning",
  "numQuestions": 5,
  "difficulty": "medium",
  "userContext": "Focus on supervised learning algorithms"
}
```

**Response**:
```json
{
  "questions": [
    {
      "id": "abc123",
      "type": "mcq",
      "prompt": "What is the output of print(type(42))?",
      "choices": [
        {"id": "a", "text": "<class 'int'>"},
        ...
      ],
      "answerKey": {"type": "choice", "value": "a"},
      "explanation": "The type() function returns the type of an object.",
      "tags": ["basics", "type-checking"]
    }
  ]
}
```

### 2. Score and Save Attempt
```
POST /api/attempts/score-and-save
Content-Type: application/json

{
  "spec": {
    "topic": "Machine Learning",
    "numQuestions": 5,
    "difficulty": "medium",
    "userContext": "Focus on supervised learning algorithms"
  },
  "quiz": {
    "questions": [...]
  },
  "responses": {
    "abc123": {"value": "a", "answeredAt": "2026-01-17T10:30:00"},
    ...
  },
  "telemetry": {"timeSpentSec": 120}
}
```

**Response**:
```json
{
  "attemptId": "xyz789",
  "createdAt": "2026-01-17T10:30:00",
  "spec": {...},
  "quiz": {...},
  "responses": {...},
  "result": {
    "score": 4,
    "maxScore": 5,
    "percent": 80.0,
    "perQuestion": [
      {"questionId": "abc123", "correct": true},
      ...
    ]
  },
  "telemetry": {"timeSpentSec": 120}
}
```

### 3. Get Attempt History
```
GET /api/attempts?limit=50
```

**Response**:
```json
[
  {
    "attemptId": "xyz789",
    "createdAt": "2026-01-17T10:30:00",
    ...
  }
]
```

## Project Structure

```
Big-Brain/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   └── quiz_attempts.db        # SQLite database (auto-created)
├── src/
│   ├── components/
│   │   ├── Quizzes.jsx        # Main quiz component
│   │   └── Quizzes.css        # Component styles
│   ├── App.jsx                 # App root
│   ├── main.jsx                # Entry point
│   └── index.css              # Global styles
├── vite.config.js             # Vite configuration with API proxy
├── package.json               # Frontend dependencies
└── README.md                  # This file
```

## Error Handling

- **Backend Down**: The frontend displays a friendly error message and doesn't crash
- **Invalid Input**: Both frontend and backend validate all inputs
- **Network Errors**: Graceful error handling with user-friendly messages

## Development Notes

- The backend uses **OpenAI GPT-4o-mini** for intelligent quiz generation
- The backend uses **built-in sqlite3** (no SQLAlchemy)
- All quiz logic is in the backend; the frontend is minimal and focused on UI/UX
- CORS is configured to allow requests from `http://localhost:5173` and `http://localhost:3000`
- **Only multiple-choice format** is supported for consistent UX

## Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

## Next Steps / Enhancements

- Add user authentication
- Implement real-time feedback and analytics
- Add more difficulty calibration
- Create advanced filtering for history
- Add export functionality for results
- Implement spaced repetition recommendations
- Add topic suggestions based on history

## License

MIT


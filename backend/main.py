"""
Quiz Generation and Tracking API
FastAPI backend for the Big-Brain quiz feature
"""

import os
import sqlite3
import json
import uuid
from datetime import datetime
from typing import Optional, Literal, List, Dict, Any, Union
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='../.env')

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# ────────────────────────────────
# PYDANTIC MODELS
# ────────────────────────────────

class QuizSpec(BaseModel):
    topic: str
    numQuestions: int
    difficulty: Literal["easy", "medium", "hard"]
    userContext: Optional[str] = None


class ChoiceOption(BaseModel):
    id: str
    text: str


class AnswerKey(BaseModel):
    type: Literal["choice", "boolean", "text"]
    value: Union[str, bool]


class QuizQuestion(BaseModel):
    id: str
    type: Literal["mcq", "tf", "short"]
    prompt: str
    choices: Optional[List[ChoiceOption]] = None
    answerKey: AnswerKey
    explanation: str
    tags: Optional[List[str]] = None


class GenerateQuizRequest(BaseModel):
    topic: str
    numQuestions: int
    difficulty: Literal["easy", "medium", "hard"]
    userContext: Optional[str] = None


class QuizResponse(BaseModel):
    questions: List[QuizQuestion]


class ResponseValue(BaseModel):
    value: Union[str, bool]
    answeredAt: str


class ScoreRequest(BaseModel):
    spec: QuizSpec
    quiz: Dict[str, Any]  # {"questions": [...]}
    responses: Dict[str, Union[str, bool, Dict[str, Any]]]
    telemetry: Optional[Dict[str, Any]] = None


class PerQuestionResult(BaseModel):
    questionId: str
    correct: bool


class QuizResult(BaseModel):
    score: int
    maxScore: int
    percent: float
    perQuestion: List[PerQuestionResult]


class QuizAttempt(BaseModel):
    attemptId: str
    createdAt: str
    spec: QuizSpec
    quiz: Dict[str, Any]
    responses: Dict[str, Any]
    result: QuizResult
    telemetry: Optional[Dict[str, Any]] = None


# ────────────────────────────────
# DATABASE
# ────────────────────────────────

class QuizDatabase:
    """SQLite database for quiz attempts"""
    
    DB_FILE = "quiz_attempts.db"
    
    @classmethod
    @contextmanager
    def get_connection(cls):
        """Context manager for database connections"""
        conn = sqlite3.connect(cls.DB_FILE)
        try:
            yield conn
        finally:
            conn.close()
    
    @classmethod
    def init_db(cls):
        """Initialize database and create table if missing"""
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS quiz_attempts (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                )
            """)
            conn.commit()
    
    @classmethod
    def save_attempt(cls, attempt: Dict[str, Any]) -> None:
        """Save a quiz attempt to the database"""
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO quiz_attempts (id, created_at, data) VALUES (?, ?, ?)",
                (attempt["attemptId"], attempt["createdAt"], json.dumps(attempt))
            )
            conn.commit()
    
    @classmethod
    def get_attempts(cls, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve quiz attempts ordered by creation date (newest first)"""
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT data FROM quiz_attempts ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()
            return [json.loads(row[0]) for row in rows]


# ────────────────────────────────
# QUIZ GENERATION
# ────────────────────────────────

class QuizGenerator:
    """OpenAI-powered quiz generator"""
    
    @classmethod
    def generate_quiz(cls, spec: QuizSpec) -> List[QuizQuestion]:
        """Generate quiz questions using OpenAI API"""
        
        # Build prompt
        context_part = f"\n\nAdditional context: {spec.userContext}" if spec.userContext else ""
        
        prompt = f"""Generate {spec.numQuestions} multiple-choice quiz questions about {spec.topic}.
Difficulty level: {spec.difficulty}{context_part}

For each question, provide:
1. A clear question prompt
2. Exactly 4 answer choices (labeled a, b, c, d)
3. The correct answer (a, b, c, or d)
4. A brief explanation of why the answer is correct

Return your response as a valid JSON array with this exact structure:
[
  {{
    "prompt": "question text",
    "choices": [
      {{"id": "a", "text": "choice A text"}},
      {{"id": "b", "text": "choice B text"}},
      {{"id": "c", "text": "choice C text"}},
      {{"id": "d", "text": "choice D text"}}
    ],
    "answer": "a",
    "explanation": "explanation text",
    "tags": ["tag1", "tag2"]
  }}
]

Make questions appropriate for {spec.difficulty} difficulty level."""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful quiz generator. Always respond with valid JSON only, no markdown formatting."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            
            # Parse the response - handle both array and object with array
            try:
                data = json.loads(content)
                # If response is an object with a questions key, extract it
                if isinstance(data, dict):
                    if "questions" in data:
                        questions_data = data["questions"]
                    else:
                        # Try to find the first array value
                        for value in data.values():
                            if isinstance(value, list):
                                questions_data = value
                                break
                        else:
                            raise ValueError("No array found in response")
                else:
                    questions_data = data
            except json.JSONDecodeError:
                # Fallback: try to extract JSON array from markdown
                content = content.strip()
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:].strip()
                questions_data = json.loads(content)
            
            # Convert to QuizQuestion objects
            questions = []
            for q_data in questions_data:
                q_id = str(uuid.uuid4())[:8]
                question = QuizQuestion(
                    id=q_id,
                    type="mcq",
                    prompt=q_data["prompt"],
                    choices=[ChoiceOption(id=c["id"], text=c["text"]) for c in q_data["choices"]],
                    answerKey=AnswerKey(type="choice", value=q_data["answer"]),
                    explanation=q_data["explanation"],
                    tags=q_data.get("tags", [])
                )
                questions.append(question)
            
            return questions
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate quiz with OpenAI: {str(e)}"
            )


# ────────────────────────────────
# SCORING
# ────────────────────────────────

class QuizScorer:
    """Compute scores for quiz attempts"""
    
    @classmethod
    def score_attempt(
        cls,
        spec: QuizSpec,
        quiz_data: Dict[str, Any],
        responses: Dict[str, Any]
    ) -> QuizResult:
        """Calculate score and per-question results"""
        questions = quiz_data.get("questions", [])
        score = 0
        per_question = []
        
        for q in questions:
            q_id = q.get("id")
            is_correct = cls.check_answer(q, responses.get(q_id, {}))
            
            if is_correct:
                score += 1
            
            per_question.append(PerQuestionResult(questionId=q_id, correct=is_correct))
        
        max_score = len(questions)
        percent = (score / max_score * 100) if max_score > 0 else 0.0
        
        return QuizResult(
            score=score,
            maxScore=max_score,
            percent=round(percent, 2),
            perQuestion=per_question
        )
    
    @classmethod
    def check_answer(cls, question: Dict[str, Any], response: Dict[str, Any]) -> bool:
        """Check if a response is correct"""
        answer_key = question.get("answerKey", {})
        key_type = answer_key.get("type")
        correct_value = answer_key.get("value")
        user_value = response.get("value")
        
        if key_type == "choice":
            return str(user_value).strip() == str(correct_value).strip()
        elif key_type == "boolean":
            # Convert string to boolean if needed
            if isinstance(user_value, str):
                user_value = user_value.lower() in ("true", "t", "yes", "1")
            return bool(user_value) == bool(correct_value)
        elif key_type == "text":
            # Case-insensitive text comparison
            return str(user_value).strip().lower() == str(correct_value).strip().lower()
        
        return False


# ────────────────────────────────
# FASTAPI APP
# ────────────────────────────────

app = FastAPI(title="Big-Brain Quiz API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup():
    QuizDatabase.init_db()


# ────────────────────────────────
# ENDPOINTS
# ────────────────────────────────

@app.post("/api/quizzes/generate", response_model=QuizResponse)
async def generate_quiz(request: GenerateQuizRequest):
    """Generate a new quiz based on spec"""
    try:
        spec = QuizSpec(**request.dict())
        questions = QuizGenerator.generate_quiz(spec)
        return QuizResponse(questions=questions)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/attempts/score-and-save", response_model=QuizAttempt)
async def score_and_save(request: ScoreRequest):
    """Score a quiz attempt and save to database"""
    try:
        # Compute score
        result = QuizScorer.score_attempt(request.spec, request.quiz, request.responses)
        
        # Create attempt record
        attempt = QuizAttempt(
            attemptId=str(uuid.uuid4()),
            createdAt=datetime.utcnow().isoformat(),
            spec=request.spec,
            quiz=request.quiz,
            responses=request.responses,
            result=result,
            telemetry=request.telemetry
        )
        
        # Save to database
        QuizDatabase.save_attempt(attempt.dict())
        
        return attempt
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/attempts", response_model=List[QuizAttempt])
async def get_attempts(limit: int = 50):
    """Retrieve quiz attempts (newest first)"""
    try:
        attempts_data = QuizDatabase.get_attempts(limit)
        # Convert raw dicts back to QuizAttempt objects for validation
        return [QuizAttempt(**attempt) for attempt in attempts_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

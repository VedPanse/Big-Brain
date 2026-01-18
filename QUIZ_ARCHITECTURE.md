# Quiz Source Architecture Implementation - Phase 1 ✅

## What's Been Implemented

### 1. **Core Data Model** 
Extended `LearningContext` to track quizzes with source metadata:

```javascript
quizzesBySource: {
  "topic-calculus": [quiz1, quiz2, ...],
  "document-notes.pdf": [quiz3, ...],
  "video-abc123": [quiz4, ...],
}
```

Each quiz now includes:
```javascript
{
  id: "quiz-123",
  questions: [...],
  sourceType: "topic" | "document" | "video",
  sourceId: "calculus",
  sourceMetadata: {
    topic: "calculus",
    // OR
    documentName: "notes.pdf",
    uploadedAt: "2026-01-17T...",
    // OR
    videoTitle: "Limits Explained",
    videoId: "xyz123",
  },
  createdAt: 1234567890,
}
```

### 2. **Context Functions** 
New functions added to `useLearning()`:

```javascript
// Store quiz with source info
storeQuizWithSource(sourceType, sourceId, sourceMetadata, quizData)

// Retrieve quizzes by source
getQuizzesForSource(sourceType, sourceId) // Returns [quizzes]

// Get all quizzes across all sources
getAllQuizzes() // Returns [all quizzes]
```

### 3. **Course Page Updates**

#### Quiz Generation
- Updated `handleGenerateQuiz()` to detect source type
- Automatically creates source metadata (topic name, document info)
- Calls `storeQuizWithSource()` to persist with metadata

#### Visual Indicators
- **Quiz Source Badge** - Shows when taking a quiz:
  - 📚 Topic
  - 📄 Document
  - 🎥 Video (ready for future)
  
- **Quiz History** - Recent attempts now display source badges
  - Easy to see which source each attempt came from

#### Source Selection UI
- Upgraded mode selector with emoji icons for clarity
- Added "Quiz source" label above selector
- Ready to add "Video" option later

### 4. **State Flow**

```
User Generates Quiz
    ↓
Choose Source Type
    - Topic: typing calculus
    - Document: uploading file
    ↓
Call API with source data
    ↓
Receive quiz from backend
    ↓
storeQuizWithSource(type, id, metadata, quiz)
    ↓
Quiz stored in context with full source info
    ↓
Quiz displayed with source badge
    ↓
Attempt saved with source metadata
```

---

## Phase 2 Ready: Next Steps

When you're ready to add document upload support:

1. ✅ **Data model is ready** - `sourceType: "document"` already handled
2. ✅ **UI partially done** - Document mode exists, just needs file upload
3. ⏳ **Backend endpoint** - May need `/api/quizzes/generate` to accept files better

When you're ready to add video transcripts:

1. ✅ **Data model is ready** - `sourceType: "video"` already structured
2. ⏳ **Source selection** - Need to show "Generate from seen videos" option
3. ⏳ **Transcript fetching** - Integrate with YouTube API for transcripts
4. ⏳ **UI** - Select from seen videos for this topic

---

## File Changes Summary

### Modified Files:
- **`/src/state/LearningContext.jsx`**
  - Added `viewedVideosByTopic` state (was missing, now consolidated)
  - Added `quizzesBySource` state
  - Added 6 new functions for quiz/video tracking

- **`/src/pages/Course.jsx`**
  - Imported `useLearning` hook
  - Updated `handleGenerateQuiz()` to detect and store source metadata
  - Added source badge display when taking quiz
  - Updated quiz history to show source indicators
  - Enhanced quiz source selector UI with emojis

---

## Testing Checklist

- [ ] Generate quiz from topic → shows 📚 badge
- [ ] Generate quiz from document → shows 📄 badge
- [ ] Quiz appears in history with correct source badge
- [ ] Reload page → quiz data persists
- [ ] Multiple quizzes from same source group correctly

---

## Architecture Benefits

✅ **Extensible**: Easy to add video, article, lecture sources later  
✅ **Trackable**: Know exactly where each quiz came from  
✅ **Replayable**: Can regenerate from same source  
✅ **Analytics-ready**: Can analyze performance by source type  
✅ **Scalable**: No changes needed to this layer when adding new sources

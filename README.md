# AI Chatbot

A polished full-stack chatbot experience powered by Next.js, FastAPI, and Groq's Llama 3.3 model. The application provides a clean light-mode interface, persistent conversation context, and a production-ready API layer for seamless frontend-backend communication.

## Tech Stack

### Frontend
- Next.js 14 with the App Router
- React and TypeScript
- Tailwind CSS for a premium light UI
- Lucide React for polished icons

### Backend
- FastAPI for a high-performance REST API
- Uvicorn as the ASGI server
- OpenAI Python SDK configured for Groq
- Pydantic for request validation
- python-dotenv for environment configuration

## Architecture Overview

```text
project-root/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   ├── package.json
│   └── .env.example
└── README.md
```

The frontend lives entirely under the frontend folder and the Python service lives entirely under the backend folder, with the API route exposed through FastAPI and consumed securely by the Next.js app.

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm
- A Groq API key from Groq Console

### 1) Backend Setup

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

- Windows:
  ```bash
  venv\Scripts\activate
  ```
- macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local environment file from the example:

```bash
copy .env.example .env
```

Update the file with your real credentials:

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=8000
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Start the backend:

```bash
python main.py
```

The API will be available at http://localhost:8000.

### 2) Frontend Setup

```bash
cd frontend
npm install
```

Create a local environment file:

```bash
copy .env.example .env.local
```

Update `.env.local` with your Google auth credentials:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

Start the frontend:

```bash
npm run dev
```

The UI will be available at http://localhost:3000.

## Features

- Real-time chat experience with Groq Llama 3.3
- Context-aware conversation history for multi-turn chats
- Google sign-in using NextAuth for session-based history
- Theme toggle with persistent dark mode preference
- Clean light/dark UI with premium minimalist spacing
- Disabled input controls during loading to prevent duplicate submissions
- Automatic scroll-to-bottom behavior for new replies
- Graceful error banners for API or connectivity failures

## API Contract

### POST /api/chat

Request body:

```json
{
  "message": "Your message here",
  "history": [
    { "role": "user", "content": "Earlier question" },
    { "role": "assistant", "content": "Earlier answer" }
  ],
  "user_email": "user@example.com",
  "chat_id": "optional-existing-chat-id"
}
```

Response:

```json
{
  "response": "Assistant reply",
  "chat_id": "new-or-existing-chat-id",
  "title": "Python Help"
}
```

### GET /api/history

Query parameters:

```text
email=user@example.com
```

Response:

```json
{
  "history": [
    {
      "chat_id": "chat-uuid",
      "title": "Python Help",
      "created_at": "2026-06-30T12:00:00+00:00",
      "updated_at": "2026-06-30T12:05:00+00:00"
    }
  ]
}
```

### GET /api/history/session

Query parameters:

```text
email=user@example.com
chat_id=chat-uuid
```

Response:

```json
{
  "chat_id": "chat-uuid",
  "title": "Python Help",
  "messages": [
    { "role": "user", "content": "Help me with Python" },
    { "role": "assistant", "content": "Of course" }
  ]
}
```

### PATCH /api/history/session/rename

Query parameters:

```text
email=user@example.com
chat_id=chat-uuid
title=Updated Title
```

### DELETE /api/history/session

Query parameters:

```text
email=user@example.com
chat_id=chat-uuid
```

### DELETE /api/history/clear-all

Query parameters:

```text
email=user@example.com
```

> Note: Session history is stored in memory for the current backend process. Restarting the backend clears stored conversations.

## Production Notes

- Keep your API key in backend environment files only.
- For production deployments, set the backend and frontend environment variables securely.
- Build the frontend with:

```bash
cd frontend
npm run build
```

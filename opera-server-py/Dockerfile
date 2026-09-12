FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=3001

WORKDIR /app

COPY requirements.lock ./

RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --require-hashes --only-binary=:all: -r requirements.lock

COPY app ./app

EXPOSE 3001

CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-3001}"]

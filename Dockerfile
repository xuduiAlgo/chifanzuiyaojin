FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
# libgl1-mesa-glx and libglib2.0-0 are often needed for opencv and others
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage cache
COPY requirements.txt .

# Install Python dependencies
# Use --no-cache-dir to keep image size smaller
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directory for TTS output
RUN mkdir -p tts_output

# Expose port
EXPOSE 5173

# Set environment variables
ENV PORT=5173
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "server.py"]

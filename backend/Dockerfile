FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-28.0.0.tgz | tar xz -C /usr/local/bin --strip-components=1 docker/docker

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

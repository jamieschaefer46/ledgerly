FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8080

WORKDIR /app

COPY server.py /app/server.py
COPY static /app/static
COPY README.md /app/README.md

RUN mkdir -p /app/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import json, urllib.request; json.load(urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=3))"

CMD ["python", "server.py"]

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3200

CMD ["uvicorn", "runner:app", "--host", "0.0.0.0", "--port", "3200"]

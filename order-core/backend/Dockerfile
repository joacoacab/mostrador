FROM python:3.12-slim

WORKDIR /app

RUN addgroup --system appuser && adduser --system --home /home/appuser --ingroup appuser appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R appuser:appuser /app

USER appuser

# Estáticos (admin de Django, drf-spectacular) horneados en la imagen.
# SECRET_KEY=build-only alcanza: collectstatic no usa la secret key.
RUN DJANGO_SECRET_KEY=build-only \
    DJANGO_ALLOWED_HOSTS=localhost \
    POSTGRES_HOST=build-only \
    python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]

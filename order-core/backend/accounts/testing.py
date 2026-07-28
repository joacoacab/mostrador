from rest_framework_simplejwt.tokens import RefreshToken


def authenticate_as(client, user):
    """Autentica un APIClient de test como `user`, vía JWT."""
    access = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

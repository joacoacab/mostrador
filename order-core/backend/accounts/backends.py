from django.contrib.auth.backends import ModelBackend

from .models import User


class TenantUnscopedModelBackend(ModelBackend):
    """Como ModelBackend, pero busca el usuario sin scoping de tenant.

    Al momento del login todavía no sabemos a qué tenant pertenece
    quien se loguea -- lo sabemos recién después de encontrarlo. Ver
    User.objects vs User.unscoped_for_auth en accounts/models.py.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None or password is None:
            return None
        try:
            user = User.unscoped_for_auth.get_by_natural_key(username)
        except User.DoesNotExist:
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None

    def get_user(self, user_id):
        # Reconstruye request.user desde la sesión (login del admin de
        # Django) en cada request. Mismo motivo que authenticate(): en
        # este punto todavía no hay tenant en contexto.
        try:
            user = User.unscoped_for_auth.get(pk=user_id)
        except User.DoesNotExist:
            return None
        return user if self.user_can_authenticate(user) else None

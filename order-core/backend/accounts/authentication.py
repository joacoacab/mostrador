from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from tenancy.context import set_current_tenant_id

from .models import User


class TenantAwareJWTAuthentication(JWTAuthentication):
    """JWTAuthentication que además fija el tenant actual.

    DRF resuelve request.user recién al despachar la vista, es decir
    después de que TenantMiddleware ya corrió (con tenant=None, porque
    todavía no había usuario). Acá, al resolver el usuario del token,
    fijamos el tenant para que el resto del request (dentro del mismo
    try/finally de TenantMiddleware) quede correctamente scopeado.
    """

    def get_user(self, validated_token):
        user_id = validated_token.get("user_id")
        if user_id is None:
            raise InvalidToken("El token no tiene user_id.")
        try:
            user = User.unscoped_for_auth.get(pk=user_id, is_active=True)
        except User.DoesNotExist as exc:
            raise InvalidToken("Usuario no encontrado.") from exc
        set_current_tenant_id(user.tenant_id)
        return user

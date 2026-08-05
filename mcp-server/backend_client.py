"""后端 API 客户端：登录获取 JWT，401 时自动重新登录并重试一次。"""
import os
from typing import Any, Optional

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000").rstrip("/")
AGENT_USERNAME = os.getenv("AGENT_USERNAME", "")
AGENT_PASSWORD = os.getenv("AGENT_PASSWORD", "")


class BackendClient:
    """薄封装 httpx，所有调用最终都走现有 FastAPI 接口，写操作自动记录 AssetLog。"""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._client = httpx.Client(base_url=BACKEND_URL, timeout=60)

    def login(self) -> str:
        resp = self._client.post(
            "/api/users/login",
            json={"username": AGENT_USERNAME, "password": AGENT_PASSWORD},
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        if not self._token:
            self.login()
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self._token}"
        resp = self._client.request(method, path, headers=headers, **kwargs)
        if resp.status_code == 401:  # token 过期，重登一次再试
            self.login()
            headers["Authorization"] = f"Bearer {self._token}"
            resp = self._client.request(method, path, headers=headers, **kwargs)
        resp.raise_for_status()
        return resp.json()

    def get(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> Any:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> Any:
        return self.request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> Any:
        return self.request("DELETE", path, **kwargs)

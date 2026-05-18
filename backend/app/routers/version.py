import subprocess
import os
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/api/version", tags=["version"])

PROJECT_ROOT = "/project"

def _run_git(cmd: list) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", PROJECT_ROOT] + cmd,
            capture_output=True, text=True, timeout=15
        )
        return result.stdout.strip()
    except Exception:
        return ""

def _run_deploy() -> tuple:
    try:
        result = subprocess.run(
            ["bash", os.path.join(PROJECT_ROOT, "deploy.sh")],
            capture_output=True, text=True, timeout=300,
            cwd=PROJECT_ROOT
        )
        return result.returncode == 0, result.stdout[-500:] if result.stdout else result.stderr[-500:]
    except subprocess.TimeoutExpired:
        return False, "Deployment timed out"
    except Exception as e:
        return False, str(e)


@router.get("")
def get_version():
    commit = _run_git(["rev-parse", "--short", "HEAD"])
    commit_full = _run_git(["rev-parse", "HEAD"])
    commit_date = _run_git(["log", "-1", "--format=%ci"])
    tag = _run_git(["describe", "--tags", "--abbrev=0"])
    return {
        "version": tag or "dev",
        "commit": commit or "unknown",
        "commit_full": commit_full or "unknown",
        "commit_date": commit_date or "unknown",
        "tag": tag or "",
    }


@router.get("/check-update")
def check_update():
    _run_git(["fetch", "origin"])
    local = _run_git(["rev-parse", "HEAD"])
    remote = _run_git(["rev-parse", "origin/main"])
    if not local or not remote:
        return {"has_update": False, "error": "Unable to check git status"}
    if local != remote:
        changes = _run_git(["log", "--oneline", f"{local}..{remote}"])
        return {
            "has_update": True,
            "current_commit": local[:7],
            "latest_commit": remote[:7],
            "changes": changes or "",
        }
    return {"has_update": False}


@router.post("/update")
def update_version(user: User = Depends(get_current_user)):
    if user.role not in ("admin", "管理员"):
        raise HTTPException(status_code=403, detail="仅管理员可执行更新")
    pull_result = _run_git(["pull", "origin"])
    if "error" in pull_result.lower() or "fatal" in pull_result.lower():
        raise HTTPException(status_code=500, detail=f"Git pull failed: {pull_result}")
    success, output = _run_deploy()
    if success:
        commit = _run_git(["rev-parse", "--short", "HEAD"])
        return {"success": True, "new_commit": commit, "message": "更新并重新部署完成"}
    else:
        return {"success": False, "error": output}

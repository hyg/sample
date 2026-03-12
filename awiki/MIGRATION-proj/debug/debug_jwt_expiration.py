#!/usr/bin/env python
"""
调试 JWT 过期和自动刷新
采集 Python 版本的详细执行数据作为基准
"""

import json
import sys
import time
import base64
from datetime import datetime
from pathlib import Path

# 添加 Python 客户端路径到 sys.path
sys.path.insert(0, str(Path(__file__).parent / "python-client"))
sys.path.insert(0, str(Path(__file__).parent / "python-client" / "scripts"))

# 采集数据的结构
trace_data = {
    "timestamp": datetime.now().isoformat(),
    "script": "debug_jwt_expiration.py",
    "credential": "hyg4awiki",
    "operations": []
}

def log_operation(step, operation_type, details):
    """记录操作日志"""
    operation = {
        "step": step,
        "type": operation_type,
        "timestamp": datetime.now().isoformat(),
        "details": details
    }
    trace_data["operations"].append(operation)
    print(f"[{step}] {operation_type}: {json.dumps(details, indent=2)}")

def main():
    credential_name = "hyg4awiki"
    
    log_operation(1, "START", {
        "script": "check_inbox.py",
        "credential": credential_name,
        "command_line": f"python check_inbox.py --credential {credential_name}"
    })
    
    # 步骤 1: 加载凭据
    log_operation(2, "LOAD_CREDENTIAL", {
        "credential_name": credential_name,
        "method": "load_identity"
    })
    
    try:
        from credential_store import load_identity
        identity = load_identity(credential_name)
        
        if identity:
            log_operation(3, "CREDENTIAL_LOADED", {
                "did": identity.get("did"),
                "user_id": identity.get("user_id"),
                "jwt_token_exists": "jwt_token" in identity,
                "jwt_token_length": len(identity.get("jwt_token", "")) if identity.get("jwt_token") else 0
            })
            
            # 检查 JWT 过期时间
            jwt_token = identity.get("jwt_token")
            if jwt_token:
                try:
                    parts = jwt_token.split('.')
                    if len(parts) == 3:
                        # 解码 JWT payload
                        payload_encoded = parts[1]
                        # 添加 padding 如果需要
                        padding = 4 - len(payload_encoded) % 4
                        if padding != 4:
                            payload_encoded += '=' * padding
                        payload = json.loads(base64.urlsafe_b64decode(payload_encoded))
                        exp = payload.get('exp')
                        if exp:
                            exp_time = datetime.fromtimestamp(exp)
                            now = datetime.now()
                            is_expired = now > exp_time
                            
                            log_operation(4, "JWT_ANALYSIS", {
                                "expires_at": exp_time.isoformat(),
                                "current_time": now.isoformat(),
                                "is_expired": is_expired,
                                "expired_seconds_ago": (now - exp_time).total_seconds() if is_expired else 0
                            })
                except Exception as e:
                    log_operation(4, "JWT_ANALYSIS_ERROR", {
                        "error": str(e)
                    })
                except Exception as e:
                    log_operation(4, "JWT_ANALYSIS_ERROR", {
                        "error": str(e)
                    })
        else:
            log_operation(3, "CREDENTIAL_NOT_FOUND", {
                "credential_name": credential_name
            })
            return
            
    except Exception as e:
        log_operation(2, "CREDENTIAL_LOAD_ERROR", {
            "error": str(e)
        })
        return
    
    # 步骤 5: 创建认证器（触发 JWT 刷新）
    log_operation(5, "CREATE_AUTHENTICATOR", {
        "method": "create_authenticator",
        "credential": credential_name
    })
    
    try:
        from credential_store import create_authenticator
        from utils import SDKConfig
        
        config = SDKConfig()
        auth_result = create_authenticator(credential_name, config)
        
        if auth_result:
            auth, data = auth_result
            log_operation(6, "AUTHENTICATOR_CREATED", {
                "did": data.did,
                "user_id": data.user_id
            })
        else:
            log_operation(6, "AUTHENTICATOR_CREATION_FAILED", {
                "reason": "create_authenticator returned None"
            })
            
    except Exception as e:
        log_operation(6, "AUTHENTICATOR_CREATION_ERROR", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        
        # 检查是否是 401 错误
        if hasattr(e, 'response') and hasattr(e.response, 'status_code'):
            status_code = e.response.status_code
            log_operation(7, "HTTP_RESPONSE", {
                "status_code": status_code,
                "response_text": e.response.text if hasattr(e.response, 'text') else str(e.response)
            })
            
            if status_code == 401:
                log_operation(8, "JWT_EXPIRED_DETECTED", {
                    "message": "Server returned 401 - JWT expired or invalid",
                    "action": "Attempting JWT refresh via WBA authentication"
                })
                
                # 尝试获取新的 JWT
                try:
                    from utils import getJwtViaWba
                    from credential_store import load_identity
                    
                    identity = load_identity(credential_name)
                    if identity:
                        new_jwt = getJwtViaWba(
                            config.user_service_url,
                            identity.did_document,
                            identity.private_key,
                            config.did_domain
                        )
                        
                        log_operation(9, "JWT_REFRESH_SUCCESS", {
                            "new_jwt_length": len(new_jwt),
                            "action": "JWT refreshed successfully"
                        })
                except Exception as refresh_error:
                    log_operation(9, "JWT_REFRESH_FAILED", {
                        "error": str(refresh_error),
                        "error_type": type(refresh_error).__name__
                    })
    
    # 保存采集的数据
    output_file = Path(__file__).parent / "python_trace_output.json"
    with open(output_file, 'w') as f:
        json.dump(trace_data, f, indent=2, default=str)
    
    log_operation(10, "FINISH", {
        "output_file": str(output_file),
        "total_operations": len(trace_data["operations"])
    })
    
    print(f"\nTrace data saved to: {output_file}")

if __name__ == "__main__":
    main()

import argparse
import importlib.util
import ipaddress
from pathlib import Path
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
OPS = ROOT / "ops/public-dev"


def load(name):
    specification = importlib.util.spec_from_file_location(name, OPS / f"{name}.py")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


class PublicRuntimeContracts(unittest.TestCase):
    def test_firewall_matches_only_original_direction_in_own_chain(self):
        script = (OPS / "firewall.sh").read_text(encoding="utf-8")
        self.assertEqual(script.count("--ctdir ORIGINAL"), 4)
        self.assertIn("CHAIN=CAPIBLOQUES_DEV_IN", script)
        self.assertNotIn('-F DOCKER-USER', script)
        self.assertIn("--filter label=com.docker.compose.service=editor", script)

    def test_compose_defaults_keep_both_ports_on_loopback(self):
        compose = (ROOT / "compose.dev.yaml").read_text(encoding="utf-8")
        self.assertIn("${CAPIBLOQUES_LOCAL_BIND_IP:-127.0.0.1}", compose)
        self.assertIn("${CAPIBLOQUES_PUBLIC_BIND_IP:-127.0.0.1}", compose)
        self.assertIn('restart: "no"', compose)
        self.assertNotIn('"npm", "run", "dev"', compose)

        nginx = (OPS / "default.conf.template").read_text(encoding="utf-8")
        self.assertIn("allow ${CAPIBLOQUES_EDGE_IP};", nginx)
        self.assertIn("default \"$http_x_forwarded_for, $remote_addr\";", nginx)
        self.assertIn("proxy_set_header X-Forwarded-For $remote_addr;", nginx)
        self.assertEqual(nginx.count('proxy_set_header Authorization "";'), 2)

    def test_edge_renderer_keeps_nginx_variables_and_custom_listener(self):
        renderer = load("render_edge")
        http = (OPS / "edge-http.conf.template").read_text(encoding="utf-8")
        rendered = renderer.render(http, {
            "CAPIBLOQUES_DEV_FQDN": "dev.example.test",
            "CAPIBLOQUES_DEV_ACME_ROOT": "/var/www/acme",
            "CAPIBLOQUES_DEV_HTTP_PORT": "80",
        })
        self.assertIn("listen 80;", rendered)
        self.assertIn("https://dev.example.test$request_uri", rendered)
        self.assertNotIn("https://$host", rendered)

        https = (OPS / "edge-https.conf.template").read_text(encoding="utf-8")
        rendered = renderer.render(https, {
            "CAPIBLOQUES_DEV_FQDN": "dev.example.test",
            "CAPIBLOQUES_DEV_HTTPS_PORT": "8443",
            "CAPIBLOQUES_DEV_UPSTREAM": "192.168.10.10:3080",
            "CAPIBLOQUES_DEV_CERTIFICATE": "/cert/fullchain.pem",
            "CAPIBLOQUES_DEV_CERTIFICATE_KEY": "/cert/privkey.pem",
            "CAPIBLOQUES_DEV_TLS_OPTIONS": "/etc/letsencrypt/options-ssl-nginx.conf",
            "CAPIBLOQUES_DEV_DHPARAM": "/etc/letsencrypt/ssl-dhparams.pem",
            "CAPIBLOQUES_DEV_BASIC_AUTH": renderer.basic_auth(None),
        })
        self.assertIn("listen 8443 ssl http2;", rendered)
        self.assertNotIn("http2 on;", rendered)
        self.assertIn("include /etc/letsencrypt/options-ssl-nginx.conf;", rendered)
        self.assertIn("ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;", rendered)
        self.assertIn("proxy_set_header X-Forwarded-For $remote_addr;", rendered)
        self.assertIn("proxy_set_header Host dev.example.test;", rendered)
        self.assertIn('proxy_set_header Authorization "";', rendered)
        self.assertNotIn("auth_basic_user_file", rendered)
        self.assertNotIn("includeSubDomains", rendered)

        protected = renderer.render(https, {
            "CAPIBLOQUES_DEV_FQDN": "dev.example.test",
            "CAPIBLOQUES_DEV_HTTPS_PORT": "8443",
            "CAPIBLOQUES_DEV_UPSTREAM": "192.168.10.10:3080",
            "CAPIBLOQUES_DEV_CERTIFICATE": "/cert/fullchain.pem",
            "CAPIBLOQUES_DEV_CERTIFICATE_KEY": "/cert/privkey.pem",
            "CAPIBLOQUES_DEV_TLS_OPTIONS": "/etc/letsencrypt/options-ssl-nginx.conf",
            "CAPIBLOQUES_DEV_DHPARAM": "/etc/letsencrypt/ssl-dhparams.pem",
            "CAPIBLOQUES_DEV_BASIC_AUTH": renderer.basic_auth("/etc/nginx/capibloques-dev.htpasswd"),
        })
        self.assertIn('auth_basic "CapiBloques DEV";', protected)
        self.assertIn("auth_basic_user_file /etc/nginx/capibloques-dev.htpasswd;", protected)
        self.assertLess(protected.index("auth_basic_user_file"), protected.index("location /"))
        self.assertLess(protected.index("auth_basic_user_file"), protected.index('proxy_set_header Authorization "";'))

        with self.assertRaises(argparse.ArgumentTypeError):
            renderer.absolute_path("/etc/nginx/site; include /tmp/evil")
        with self.assertRaises(argparse.ArgumentTypeError):
            renderer.upstream("203.0.113.20:3080")

    def test_static_runtime_is_pinned_and_contains_no_node_runtime(self):
        dockerfile = (OPS / "Dockerfile").read_text(encoding="utf-8")
        self.assertIn("nginxinc/nginx-unprivileged:1.30.4-alpine@sha256:b8c179", dockerfile)
        runtime = dockerfile.split("FROM nginxinc/", 1)[1]
        self.assertNotIn("wrangler", runtime.lower())
        self.assertNotIn("vinext", runtime.lower())
        self.assertIn("backend/accounts/preferences_catalog.json", dockerfile)

    def test_deploy_recreates_api_and_rollback_reads_image_revision(self):
        runtime = (OPS / "runtime.py").read_text(encoding="utf-8")
        self.assertIn('"--force-recreate"', runtime)
        self.assertIn('org.opencontainers.image.revision', runtime)
        self.assertIn('ensure_build_window()', runtime)
        self.assertLess(runtime.index("stop_web()", runtime.index("def deploy")), runtime.index('"build", "editor"'))
        self.assertIn("CAPIBLOQUES_API_RECREATE_REQUIRED", runtime)
        self.assertIn("if not candidate_exists:", runtime)

    def test_reconfiguration_keeps_listener_closed_until_api_recreate(self):
        installer = (OPS / "install.py").read_text(encoding="utf-8")
        self.assertIn("API_BOUNDARY_KEYS", installer)
        self.assertIn('CAPIBLOQUES_API_RECREATE_REQUIRED"] = "true"', installer)
        self.assertIn('systemctl", "disable", WEB_UNIT_TARGET.name', installer)
        self.assertIn('ip", "-j", "address", "show"', installer)
        self.assertIn('ip", "-j", "route", "get"', installer)

    def test_installer_rejects_non_lan_values_and_changed_named_network(self):
        installer = load("install")
        with self.assertRaises(argparse.ArgumentTypeError):
            installer.exact_ipv4("100.64.0.1", private=True)
        with self.assertRaises(argparse.ArgumentTypeError):
            installer.private_network("172.30.13.1/29")

        outputs = [
            "network-id\n",
            'capibloques-dev_public_api [{"Subnet":"172.30.14.0/29"}]\n',
        ]
        with patch.object(installer.subprocess, "check_output", side_effect=outputs):
            with self.assertRaises(SystemExit):
                installer.validate_docker_subnet(ipaddress.ip_network("172.30.13.0/29"))

    def test_runtime_refuses_to_open_with_stale_api_boundary(self):
        runtime = load("runtime")
        with self.assertRaises(SystemExit):
            runtime.require_current_api({"CAPIBLOQUES_API_RECREATE_REQUIRED": "true"})
        runtime.require_current_api({"CAPIBLOQUES_API_RECREATE_REQUIRED": "false"})


if __name__ == "__main__":
    unittest.main()

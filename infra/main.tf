terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── Firestore ───────────────────────────────────────────────────────────────

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

# ─── Secret Manager — PB credentials ────────────────────────────────────────

resource "google_secret_manager_secret" "pb_client_secret" {
  secret_id = "pb-client-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "pb_client_secret_value" {
  secret      = google_secret_manager_secret.pb_client_secret.id
  secret_data = var.pb_client_secret
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "pb-jwt-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret_value" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

# ─── Artifact Registry ──────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "pb_automate" {
  location      = var.region
  repository_id = "pb-automate"
  format        = "DOCKER"
}

# ─── Cloud Run ───────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "backend" {
  name     = "pb-automate-backend"
  location = var.region

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/pb-automate/backend:latest"

      env {
        name  = "PB_CLIENT_ID"
        value = var.pb_client_id
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "FIRESTORE_COLLECTION"
        value = "pb_automate"
      }
      env {
        name  = "FRONTEND_URL"
        value = var.frontend_url
      }
      env {
        name = "PB_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.pb_client_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      ports {
        container_port = 8080
      }
    }
  }
}

# Allow unauthenticated access to Cloud Run (public API)
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.backend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Cloud Scheduler — hourly sync job ───────────────────────────────────────

resource "google_cloud_scheduler_job" "hourly_sync" {
  name     = "pb-automate-hourly-sync"
  schedule = "0 * * * *"
  time_zone = "UTC"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.backend.uri}/scripts/scheduled-run"
    headers = {
      "Content-Type" = "application/json"
    }
  }
}

# ─── Cloud Scheduler — daily sync job ────────────────────────────────────────

resource "google_cloud_scheduler_job" "daily_sync" {
  name     = "pb-automate-daily-sync"
  schedule = "0 0 * * *"
  time_zone = "UTC"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.backend.uri}/scripts/scheduled-run"
    headers = {
      "Content-Type" = "application/json"
    }
  }
}

# ─── Outputs ─────────────────────────────────────────────────────────────────

output "backend_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "oauth_redirect_uri" {
  value = "${google_cloud_run_v2_service.backend.uri}/auth/callback"
}

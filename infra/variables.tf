variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run and other resources"
  type        = string
  default     = "us-central1"
}

variable "pb_client_id" {
  description = "Productboard OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "pb_client_secret" {
  description = "Productboard OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret for signing JWT session tokens"
  type        = string
  sensitive   = true
}

variable "frontend_url" {
  description = "URL of the deployed frontend"
  type        = string
  default     = ""
}

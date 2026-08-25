variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "app_name" {
  description = "Application name prefix for resources"
  type        = string
  default     = "rag-backend"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "jwt_secret" {
  description = "Secret key for JWT token signing"
  type        = string
  sensitive   = true
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  default     = ""
}

variable "supabase_service_role_key" {
  description = "Supabase service role secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "nara_router_api_key" {
  description = "API key for LLM Router"
  type        = string
  sensitive   = true
  default     = ""
}

variable "nara_router_base_url" {
  description = "Base URL for LLM Router"
  type        = string
  default     = "https://router.bynara.id/v1"
}

variable "cors_allowed_origins" {
  description = "Allowed origins for CORS"
  type        = list(string)
  default = [
    "https://rag-pdf-assistant-35992.web.app",
    "https://rag-pdf-assistant-35992.firebaseapp.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 60
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 1024
}



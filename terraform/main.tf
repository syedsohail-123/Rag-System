terraform {
  required_version = ">= 1.3.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ----------------- Unique S3 Bucket for PDF Storage -----------------

resource "random_string" "bucket_suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "aws_s3_bucket" "documents_bucket" {
  bucket        = "${var.app_name}-docs-${var.environment}-${random_string.bucket_suffix.result}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "documents_bucket_pab" {
  bucket = aws_s3_bucket.documents_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "documents_bucket_cors" {
  bucket = aws_s3_bucket.documents_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

# ----------------- IAM Execution Role for Lambda -----------------

resource "aws_iam_role" "lambda_exec" {
  name = "${var.app_name}-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic CloudWatch logging policy
resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 Access Policy for Lambda
resource "aws_iam_policy" "lambda_s3_access" {
  name        = "${var.app_name}-s3-policy-${var.environment}"
  description = "Allows Lambda full access to the documents S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.documents_bucket.arn,
          "${aws_s3_bucket.documents_bucket.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_s3_access.arn
}

# ----------------- Lambda Function Package -----------------

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/backend_lambda.zip"
  excludes = [
    "venv",
    "__pycache__",
    ".pytest_cache",
    "uploads",
    "*.pyc"
  ]
}

resource "aws_lambda_function" "api_backend" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.app_name}-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "main.handler"
  runtime          = "python3.11"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  environment {
    variables = {
      PROJECT_NAME              = "AI PDF Document Assistant (RAG)"
      JWT_SECRET                = var.jwt_secret
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
      NARA_ROUTER_API_KEY       = var.nara_router_api_key
      NARA_ROUTER_BASE_URL      = var.nara_router_base_url
      AWS_S3_BUCKET             = aws_s3_bucket.documents_bucket.bucket
    }
  }
}

# ----------------- Lambda Function URL (Supports SSE Streaming & CORS) -----------------

resource "aws_lambda_function_url" "api_function_url" {
  function_name      = aws_lambda_function.api_backend.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"

  cors {
    allow_credentials = true
    allow_origins     = var.cors_allowed_origins
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

# Allow public invocation for Function URL
resource "aws_lambda_permission" "allow_public_function_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api_backend.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

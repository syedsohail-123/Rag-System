output "api_endpoint_url" {
  description = "Public URL for the Lambda FastAPI backend (replace in frontend NEXT_PUBLIC_API_URL)"
  value       = aws_lambda_function_url.api_function_url.function_url
}

output "s3_bucket_name" {
  description = "AWS S3 Bucket created for PDF documents"
  value       = aws_s3_bucket.documents_bucket.bucket
}

output "lambda_function_arn" {
  description = "ARN of the deployed Lambda function"
  value       = aws_lambda_function.api_backend.arn
}

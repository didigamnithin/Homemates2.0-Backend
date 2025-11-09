#!/bin/bash
# Deployment script for Google Cloud Run

set -e

PROJECT_ID="homemates2"
SERVICE_NAME="homemates-backend"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Starting deployment to Google Cloud Run..."
echo "Project: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${REGION}"
echo ""

# Step 1: Enable required APIs
echo "📋 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  --project=${PROJECT_ID}

# Step 2: Build and push Docker image
echo "🔨 Building Docker image..."
# Check if we're already in the backend directory
if [ ! -f "package.json" ] || [ ! -f "Dockerfile" ]; then
    # We're not in backend directory, try to cd into it
    if [ -d "backend" ]; then
        cd backend
    else
        echo "❌ Error: Must run from project root or backend directory"
        exit 1
    fi
fi
gcloud builds submit --tag ${IMAGE_NAME} --project=${PROJECT_ID}

# Step 3: Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --project=${PROJECT_ID}

# Step 4: Get service URL
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Service URL:"
gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format 'value(status.url)' \
  --project=${PROJECT_ID}

echo ""
echo "📋 Next steps:"
echo "1. Set environment variables:"
echo "   gcloud run services update ${SERVICE_NAME} \\"
echo "     --update-env-vars \"JWT_SECRET=your-secret,PERPLEXITY_API_KEY=your-key,RINGG_API_KEY=your-ringg-key,FRONTEND_URL=https://your-frontend-domain.com\" \\"
echo "     --region ${REGION} \\"
echo "     --project=${PROJECT_ID}"
echo ""
echo "2. View logs:"
echo "   gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --project=${PROJECT_ID}"


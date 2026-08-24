pipeline {
    agent any

    stages {
        stage('Checkout Source') {
            steps {
                checkout scm
            }
        }

        stage('Backend: Install & Validate') {
            steps {
                dir('backend') {
                    sh '''
                        python3 -m venv venv
                        . venv/bin/activate
                        pip install --upgrade pip
                        pip install -r requirements.txt
                    '''
                }
            }
        }

        stage('Frontend: Install & Build') {
            steps {
                dir('frontend') {
                    sh '''
                        npm install
                        npm run build
                    '''
                }
            }
        }

        stage('Deploy Services') {
            steps {
                sh '''
                    echo "Deploying applications on WSL CentOS..."
                    # Example deployment steps:
                    # systemctl restart rag-backend
                    # pm2 restart rag-frontend
                '''
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully on WSL CentOS!'
        }
        failure {
            echo 'Pipeline build failed. Check logs above.'
        }
    }
}

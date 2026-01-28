SHELL := /bin/bash

STACK_NAME ?= session-tracking
STAGE ?= dev
REGION ?= us-east-1
PROFILE ?= default
AWS_ACCOUNT_ID ?= 033156084586

TEMPLATE := template.yaml
PARAMS := parameters.yaml

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  make build            Build SAM application"
	@echo "  make validate         Validate CloudFormation template"
	@echo "  make deploy           Deploy stack"
	@echo "  make deploy-guided    First-time guided deploy"
	@echo "  make logs             Tail Lambda logs"
	@echo "  make destroy          Delete stack"
	@echo "  make outputs          Show stack outputs"

.PHONY: build
build:
	sam build \
		--template $(TEMPLATE)

.PHONY: validate
validate:
	sam validate \
		--template $(TEMPLATE)

.PHONY: deploy
deploy:
	sam deploy \
		--template-file .aws-sam/build/$(TEMPLATE) \
		--stack-name $(STACK_NAME)-$(STAGE) \
		--region $(REGION) \
		--profile $(PROFILE) \
		--resolve-s3 \
		--parameter-overrides \
			StageName=$(STAGE) \
		--capabilities CAPABILITY_IAM \
		--no-fail-on-empty-changeset

.PHONY: deploy-guided
deploy-guided:
	sam deploy --guided

.PHONY: destroy
destroy:
	sam delete \
		--stack-name $(STACK_NAME)-$(STAGE) \
		--region $(REGION) \
		--profile $(PROFILE)

.PHONY: logs
logs:
	sam logs \
		--stack-name $(STACK_NAME)-$(STAGE) \
		--region $(REGION) \
		--profile $(PROFILE) \
		--tail

.PHONY: outputs
outputs:
	aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME)-$(STAGE) \
		--region $(REGION) \
		--profile $(PROFILE) \
		--query "Stacks[0].Outputs"

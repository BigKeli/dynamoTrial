### Overview

This repository contains an AWS infrastructure stack named Talent.

### Stack Components

- An Amazon DynamoDB table with a partition key, a sort key, and at least one Global Secondary Index (GSI).
- A script for populating the DynamoDB table with fictitious data.
- A set of example queries demonstrating different data access patterns supported by the table.
- An AWS Lambda function that communicates directly with DynamoDB.
- An Amazon API Gateway HTTP API that forwards requests to the Lambda function.

### Scope

All components are defined as part of a single stack and are intended to work together as a minimal, functional setup demonstrating DynamoDB access through an HTTP API backed by Lambda.

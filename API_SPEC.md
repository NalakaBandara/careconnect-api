# CareConnect API Specification

## 1. API Overview

Base URL:

/api/v1

Authentication:

Auth0 Bearer Access Token

Authorization:

CareConnect RBAC

---

# 2. Authentication / Current User

## GET /api/v1/me

### Description

Returns the currently authenticated CareConnect user.

### Authentication

Required

### Auth0 Permission

read:profile

### Allowed Roles

- PATIENT
- DOCTOR
- HOSPITAL
- ADMIN

### Request

No request body.

### Response - 200 OK

{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "role": "PATIENT"
}

### Errors

401 - Missing or invalid Auth0 access token

403 - Authenticated client does not have required permission

404 - CareConnect user not found

---

# 3. Patient

## GET /api/v1/patients/me

### Description

Returns the profile of the currently authenticated patient.

### Authentication

Required

### Auth0 Permission

read:profile

### Allowed Roles

- PATIENT

### Request

No request body.

### Response - 200 OK

{
  "id": 1,
  "username": "john",
  "email": "john@example.com"
}

---

## PUT /api/v1/patients/me

### Description

Updates the profile of the currently authenticated patient.

### Authentication

Required

### Auth0 Permission

write:profile

### Allowed Roles

- PATIENT

### Request

{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "0771234567"
}

### Response - 200 OK

Returns the updated patient profile.

### Errors

400 - Invalid request

401 - Missing or invalid token

403 - User is not a PATIENT
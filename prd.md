# prd.md

# Product Requirements Document (PRD)

**Version:** 1.1

**Status:** Living Document

---

# Executive Summary

IoTOS AI is an AI-powered, local-first desktop application that transforms how beginners build Arduino and ESP32 projects.

Instead of forcing users to learn multiple disconnected tools, IoTOS AI provides a single intelligent workspace where users can describe a project in natural language, generate firmware with AI, upload it to supported hardware, and immediately observe results.

Prototype V0.1 validates one seamless workflow:

> **Describe → Generate → Upload → Run**
> 

---

# Vision

To become the world’s most intuitive AI-powered development environment for Arduino, ESP32, and future embedded platforms.

---

# Mission

Reduce the learning curve of embedded development through a single intelligent desktop application.

---

# Product Philosophy

Every feature must answer:

> **Does this make embedded development easier for beginners?**
> 

If the answer is no, it does not belong.

Reliability always takes priority over feature count.

---

# Core Principles

## Simplicity First

Every screen should focus on one primary task.

## Reliability Over Features

Stable software is more valuable than feature quantity.

## Progressive Learning

Generated firmware should remain editable and understandable.

## Local-First

Prototype V0.1 runs locally.

Internet is only required when requesting AI-generated firmware.

---

# Problem Statement

Today’s embedded workflow requires multiple disconnected tools, confusing setup, and difficult debugging, causing many beginners to give up before completing their first project.

---

# Opportunity

IoTOS AI combines:

- AI firmware generation
- Automatic board detection
- One-click upload
- Integrated Serial Monitor
- Beginner-friendly templates

into one cohesive desktop application.

---

# Target Audience

## Primary

- Engineering students
- Diploma students
- BCA students
- Beginners
- Makers
- Robotics clubs

## Secondary

- Teachers
- Educational institutions
- STEM educators

---

# Product Positioning

IoTOS AI combines the usability of modern AI-assisted development tools with embedded systems development.

It complements professional IDEs instead of replacing them.

---

# Core Product Promise

`Users should be able to:`

- Describe
- Generate
- Upload
- Run

their embedded projects within minutes.

---

# Prototype V0.1 Scope

Supported Boards:

- Arduino Uno
- Arduino Nano
- ESP32 DevKit

Core Features:

- Automatic board detection
- Three templates
- AI firmware generation
- Firmware editor
- One-click upload
- Integrated Serial Monitor
- Friendly error messages

---

# High-Level Technical Architecture

Presentation Layer

- React
- Electron Renderer

↓

Application Layer

- Electron Main Process
- IPC
- BoardService
- UploadService
- SerialService
- AIService
- ProjectService
- SettingsService

↓

Hardware Layer

- Arduino CLI
- SerialPort
- Local File System

↓

External AI Provider

- LLM API

The Electron Main Process acts as the application’s local backend.

---

# User Journey

1. Launch application.
2. Connect board.
3. Detect automatically.
4. Choose template or describe idea.
5. Generate firmware.
6. Edit if required.
7. Upload.
8. Serial Monitor opens.
9. Hardware runs.

---

# AI Responsibilities

AI generates firmware, explains code, recommends components and wiring.

AI does not compile, upload firmware, detect hardware or install drivers.

---

# Home Dashboard

Prototype V0.1 includes a lightweight application dashboard displaying:

- Connected board
- Status
- Recent projects
- Quick actions

This is not an IoT cloud dashboard.

---

# Explicit Non-Goals

Prototype V0.1 excludes:

- Dedicated cloud backend
- Remote databases
- Authentication
- OTA
- Cloud synchronization
- Collaboration
- Marketplace
- Mobile app
- Circuit simulation

---

# Future Vision

Future versions may include:

- Cloud dashboards
- OTA
- AI circuit debugging
- Plugin ecosystem
- Institution portal
- Collaboration

---

# Performance Targets

- Startup <3 seconds
- Board detection <2 seconds
- Responsive UI
- Auto-open Serial Monitor
- Zero demo crashes

---

# Success Metrics

A beginner should be able to complete the entire workflow without external assistance.

---

# Engineering Guiding Principles

Prioritize:

1. Reliability
2. Simplicity
3. Beginner experience
4. Maintainability
5. Extensibility

---

# Prototype Architecture Note

Prototype V0.1 intentionally avoids dedicated server infrastructure.

The Electron Main Process functions as the application’s local backend and manages hardware communication, firmware uploads, serial communication, local storage and AI provider integration.

---

# Definition of Success

Success is measured by confidence, not feature count.

If a beginner can describe an idea, generate firmware, upload it and immediately see working hardware without frustration, the prototype has succeeded.

---

# Closing Statement

IoTOS AI proves one idea:

> **Embedded development should feel as natural as describing an idea.**
> 

Every engineering decision should strengthen:

> **Describe → Generate → Upload → Run**
> 

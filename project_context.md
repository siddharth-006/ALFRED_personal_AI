# ALFRED OS - Project Context

## Overview

ALFRED OS is a lightweight personal productivity dashboard designed for students, developers, and self-learners.

The goal is to provide a centralized workspace for managing:

* Daily Tasks
* Weekly Goals
* Monthly Goals
* Projects
* Productivity Streaks
* Workspace Launchers

ALFRED must remain:

* Lightweight
* Offline First
* Fast
* Minimal
* Modern
* Easy to use daily

No cloud services are required.

No authentication is required.

No external APIs are required.

All data should be stored locally.

---

# Technology Stack

Frontend:

* Next.js
* TypeScript
* Tailwind CSS

Storage:

* localStorage

Deployment:

* Local machine

Theme:

* Dark Mode

Architecture:

* Component Based

---

# Design Language

The application should follow a modern productivity dashboard style.

Design principles:

* Dark background
* Rounded cards
* Consistent spacing
* Responsive layout
* Minimal distractions
* Professional appearance

Inspiration:

* Notion
* Linear
* Raycast
* Modern SaaS dashboards

---

# Current Features

## Dashboard

Displays:

* Current Streak
* Today's Progress
* Tasks Completed
* Goals Progress
* Active Projects

Dashboard should always reflect real application data.

No hardcoded statistics.

---

## Tasks Module

Features:

* Add Task
* Edit Task
* Delete Task
* Complete Task
* Categories

Categories:

* DSA
* Data Science
* College
* Hackathon
* Personal

Stored in localStorage.

Dashboard integrates with tasks automatically.

---

## Goals Module

Goal Types:

* Weekly Goals
* Monthly Goals

Features:

* Add Goal
* Edit Goal
* Delete Goal
* Progress Tracking
* Completion Status

Goal completion is automatic when target is reached.

Stored in localStorage.

Dashboard integrates with goals automatically.

---

## Streak System

Track:

* currentStreak
* lastActiveDate

Rules:

* Completing at least one task counts as activity.
* Same-day activity should not increase streak more than once.
* Consecutive days increase streak.
* Missing a day resets streak.

Stored in localStorage.

Dashboard integrates with streaks automatically.

---

## Projects Module

Each project contains:

* Name
* Description
* Category
* Status
* Progress Percentage
* Creation Date

Categories:

* DSA
* Data Science
* College
* Hackathon
* Personal

Statuses:

* Not Started
* In Progress
* Completed

Features:

* Add Project
* Edit Project
* Delete Project
* Update Progress

Projects automatically mark as completed at 100%.

Stored in localStorage.

Dashboard displays top active projects.

---

# Future Features

## Workspace Launcher

Predefined workspaces:

* DSA
* Data Science
* Hackathon

Each workspace launches relevant applications and websites.

---

## Session Tracking

Track:

* Study Hours
* Daily Sessions
* Weekly Productivity

---

## Analytics

Display:

* Weekly Progress
* Monthly Progress
* Productivity Trends

---

# Development Rules

1. No hardcoded dashboard values.
2. All dashboard statistics must come from application data.
3. Use reusable React components.
4. Prefer TypeScript types and interfaces.
5. Keep code modular.
6. Use localStorage for persistence.
7. Maintain dark theme consistency.
8. Avoid unnecessary dependencies.
9. Keep performance lightweight.
10. Build features incrementally without breaking existing modules.

---

# Product Vision

ALFRED should become a personal productivity operating system.

The application should help users:

* Plan work
* Track progress
* Maintain consistency
* Manage projects
* Stay focused

The experience should feel simple, fast, and reliable enough to be used every day.

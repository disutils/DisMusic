# disutils-website

![Python](https://img.shields.io/badge/Python-3.12-blue)

> [!CAUTION]
> **This source requires Python version 3.12.x strictly.**
>
> - Ensure you have Python 3.12.x installed before proceeding. Using any other version may result in critical errors or unexpected behavior.
> - [Download Python 3.12.x](https://www.python.org/downloads/) if you do not already have it installed.

> [!WARNING]
> **Before doing anything with this source, please read the following resources carefully:**
>
> - [Project Management Repository](https://github.com/disutils/Project-Management/blob/main/README.md) – Guidelines, issue tracking, and collaboration rules.
> - [License Repository](https://github.com/disutils/LICENSE/blob/main/LICENSE) – Licensing requirements, contribution terms, and usage policies.

> Failing to follow these requirements may result in critical errors, permission issues, or policy violations.


## 📦 Requirements

* Python 3.12 (strictly required)
* [`discord.py`](https://pypi.org/project/discord.py/)
* [`disckit`](https://pypi.org/project/disckit/)
* [`uv`](https://pypi.org/project/uv/) for dependency management

> 💡 Want a deeper guide on using `uv`, setting up projects, or managing dependencies?
> Check out the [Project-Management repository](https://github.com/disutils/Project-Management) — it covers these workflows in more detail.

## 🚀 Getting Started

Clone this repo and install the requirements:

```bash
pip install uv
```

Sync dependencies using:

```bash
uv sync
```

Then run the bot:

```bash
uv run main.py
```
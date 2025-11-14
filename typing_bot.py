"""Utility helpers for Selenium scripts that type EdClub lessons.

The user already has a fairly big automation script (see the conversation history)
and only needs to drop a couple of new helper calls into it.  This file keeps all
logic related to parsing the lesson markup so the main script can stay focused on
launching the browser, logging in and iterating over the assignments.

Typical usage in the existing script looks like this::

    from typing_bot import type_current_lesson

    # inside run_typing_tasks_improved(...)
    input_field = driver.find_element(By.CLASS_NAME, "cursor")
    typed = type_current_lesson(driver, input_field, char_delay=0.2, word_delay=0.5)
    logger.info("Введено символов: %s", typed)

Nothing else in the original automation needs to change – the helper figures out
где нужно нажимать Enter, где печатать пробел и т.д.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement


@dataclass
class TypingToken:
    """Normalized representation of a character to type."""

    element: WebElement
    value: str

    @property
    def is_enter(self) -> bool:
        """Whether the token represents a required Enter keystroke."""

        if self.value == "\n":
            return True
        classes = (self.element.get_attribute("class") or "").split()
        return any(cls in {"_enter", "newline"} for cls in classes)

    @property
    def is_space(self) -> bool:
        return self.value == " "


TOKEN_SELECTORS = (
    ".typable .token_unit",
    ".typable .token",
    ".typable [data-char]",
)


def iter_token_elements(driver: WebDriver) -> Iterable[WebElement]:
    """Yield token nodes in the order they appear on the page."""

    for selector in TOKEN_SELECTORS:
        elements = driver.find_elements(By.CSS_SELECTOR, selector)
        if elements:
            yield from elements
            return
    return []


def normalize_token(element: WebElement) -> TypingToken | None:
    """Convert a token element to a TypingToken.

    The EdClub markup uses different attributes to represent characters.  The
    raw text is not reliable because spaces and enters are represented by
    dedicated markup, so we must inspect attributes and helper classes.
    """

    value = (
        element.get_attribute("data-char")
        or element.get_attribute("data-value")
        or element.text
    )

    if value is None:
        return None

    value = value.replace("\xa0", " ").strip("\r")
    if value == "":
        # This might be a space token that hides the character inside an <i> tag
        if element.find_elements(By.TAG_NAME, "i"):
            value = " "
        else:
            # No visible value and no special markers – ignore it.
            return None

    if "_enter" in (element.get_attribute("class") or ""):
        value = "\n"

    if value == "↵":
        value = "\n"

    return TypingToken(element=element, value=value)


def collect_tokens(driver: WebDriver) -> List[TypingToken]:
    """Return the normalized list of tokens for the current lesson."""

    tokens: List[TypingToken] = []
    for element in iter_token_elements(driver):
        token = normalize_token(element)
        if token is not None:
            tokens.append(token)
    return tokens


def type_tokens(driver: WebDriver, input_field: WebElement, *, char_delay: float = 0.18, word_delay: float = 0.45) -> None:
    """Type all lesson tokens into the focused input field.

    Each token decides on its own which key should be sent.  The calling code
    can keep its delay logic unchanged – once the token sequence is correct the
    final line will no longer trigger validation errors.
    """

    from time import sleep

    for token in collect_tokens(driver):
        if token.is_enter:
            input_field.send_keys(Keys.RETURN)
            sleep(word_delay)
            continue

        if token.is_space:
            input_field.send_keys(Keys.SPACE)
            sleep(word_delay)
            continue

        input_field.send_keys(token.value)
        sleep(char_delay)


def type_current_lesson(
    driver: WebDriver,
    input_field: WebElement,
    *,
    char_delay: float = 0.18,
    word_delay: float = 0.45,
) -> int:
    """Type the visible lesson text and return the amount of characters pressed.

    This is the entry point that can be imported by the original automation
    script.  It does three small things:

    1. Collects tokens with :func:`collect_tokens` so пробелы/Enter не потерялись.
    2. Передаёт их в :func:`type_tokens`, используя заданные задержки.
    3. Возвращает количество успешно обработанных токенов – это удобно для
       логирования или дополнительных проверок.
    """

    tokens = collect_tokens(driver)
    type_tokens(driver, input_field, char_delay=char_delay, word_delay=word_delay)
    return len(tokens)

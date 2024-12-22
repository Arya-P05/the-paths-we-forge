(function (storyContent) {
  // Create ink story from the content using inkjs
  var story = new inkjs.Story(storyContent);

  // Global tags - those at the top of the ink file
  var globalTags = story.globalTags;
  if (globalTags) {
    for (var i = 0; i < story.globalTags.length; i++) {
      var globalTag = story.globalTags[i];
      var splitTag = splitPropertyTag(globalTag);

      // THEME: dark
      if (splitTag && splitTag.property == "theme") {
        document.body.classList.add(splitTag.val);
      }

      // author: Your Name
      else if (splitTag && splitTag.property == "author") {
        var byline = document.querySelector(".byline");
        byline.innerHTML = "by " + splitTag.val;
      }
    }
  }

  var storyContainer = document.querySelector("#story");
  var outerScrollContainer = document.querySelector(".outerContainer");

  // Keep track of the last highlighted section and whether the first decision is made
  var lastHighlightedSection = null;
  var firstDecisionMade = false;

  // Kick off the start of the story!
  continueStory(true);

  // Main story processing function. Each time this is called it generates
  // all the next content up as far as the next set of choices.
  function continueStory(firstTime) {
    var paragraphIndex = 0;
    var delay = 0.0;

    // Don't over-scroll past new content
    var previousBottomEdge = firstTime ? 0 : contentBottomEdgeY();

    // Generate story text - loop through available content
    var currentSectionParagraphs = []; // Array to keep track of paragraphs in the current section
    while (story.canContinue) {
      // Get ink to generate the next paragraph
      var paragraphText = story.Continue();
      var tags = story.currentTags;

      // Any special tags included with this line
      var customClasses = [];
      for (var i = 0; i < tags.length; i++) {
        var tag = tags[i];

        // Detect tags of the form "X: Y". Currently used for IMAGE and CLASS but could be
        // customised to be used for other things too.
        var splitTag = splitPropertyTag(tag);

        // IMAGE: src
        if (splitTag && splitTag.property == "IMAGE") {
          var imageElement = document.createElement("img");
          imageElement.src = splitTag.val;
          storyContainer.appendChild(imageElement);

          showAfter(delay, imageElement);
          delay += 200.0;
        }

        // CLASS: className
        else if (splitTag && splitTag.property == "CLASS") {
          customClasses.push(splitTag.val);
        }

        // CLEAR - removes all existing content.
        // RESTART - clears everything and restarts the story from the beginning
        else if (tag == "CLEAR" || tag == "RESTART") {
          removeAll("p");
          removeAll("img");

          // Comment out this line if you want to leave the header visible when clearing
          setVisible(".header", false);

          if (tag == "RESTART") {
            restart();
            return;
          }
        }
      }

      // Create paragraph element (initially hidden)
      var paragraphElement = document.createElement("p");
      paragraphElement.innerHTML = paragraphText;
      storyContainer.appendChild(paragraphElement);

      // Add any custom classes derived from ink tags
      for (var i = 0; i < customClasses.length; i++) {
        paragraphElement.classList.add(customClasses[i]);
      }

      // Store the paragraph in the current section array
      currentSectionParagraphs.push(paragraphElement);

      // Fade in paragraph after a short delay
      showAfter(delay, paragraphElement);
      delay += 200.0;

      // Break when we hit a choice (we'll highlight the entire section at once)
      if (story.currentChoices.length > 0) {
        // Mark that the first decision is now made
        firstDecisionMade = true;
        break;
      }
    }

    // Add highlight to the entire section after the first decision
    if (firstDecisionMade && currentSectionParagraphs.length > 0) {
      if (lastHighlightedSection) {
        // Remove highlight from the last section
        lastHighlightedSection.forEach(function (paragraph) {
          paragraph.classList.remove("highlight");
        });
      }

      // Highlight the current section
      currentSectionParagraphs.forEach(function (paragraph) {
        if (
          !(
            paragraph.classList.contains("title") ||
            paragraph.classList.contains("subtitle") ||
            paragraph.classList.contains("initial")
          )
        ) {
          paragraph.classList.add("highlight");
        }
      });

      // Update the last highlighted section
      lastHighlightedSection = currentSectionParagraphs;
    }

    // Create HTML choices from ink choices
    story.currentChoices.forEach(function (choice) {
      // Create paragraph with anchor element
      var choiceParagraphElement = document.createElement("p");
      choiceParagraphElement.classList.add("choice");
      choiceParagraphElement.innerHTML = `<a href='#'>${choice.text}</a>`;
      storyContainer.appendChild(choiceParagraphElement);

      // Fade choice in after a short delay
      showAfter(delay, choiceParagraphElement);
      delay += 200.0;

      // Click on choice
      var choiceAnchorEl = choiceParagraphElement.querySelectorAll("a")[0];
      choiceAnchorEl.addEventListener("click", function (event) {
        // Don't follow <a> link
        event.preventDefault();

        // Remove all existing choices
        removeAll("p.choice");

        // Tell the story where to go next
        story.ChooseChoiceIndex(choice.index);

        // Aaand loop
        continueStory();
      });
    });

    // Extend height to fit
    storyContainer.style.height = contentBottomEdgeY() + "px";

    if (!firstTime) scrollDown(previousBottomEdge);
  }

  function restart() {
    story.ResetState();

    setVisible(".header", true);

    continueStory(true);

    outerScrollContainer.scrollTo(0, 0);
  }

  // -----------------------------------
  // Various Helper functions
  // -----------------------------------

  // Fades in an element after a specified delay
  function showAfter(delay, el) {
    el.classList.add("hide");
    setTimeout(function () {
      el.classList.remove("hide");
    }, delay);
  }

  // Scrolls the page down, but no further than the bottom edge of what you could
  // see previously, so it doesn't go too far.
  function scrollDown(previousBottomEdge) {
    // Line up top of screen with the bottom of where the previous content ended
    var target = previousBottomEdge;

    // Can't go further than the very bottom of the page
    var limit =
      outerScrollContainer.scrollHeight - outerScrollContainer.clientHeight;
    if (target > limit) target = limit;

    var start = outerScrollContainer.scrollTop;

    var dist = target - start;
    var duration = 300 + (300 * dist) / 100;
    var startTime = null;
    function step(time) {
      if (startTime == null) startTime = time;
      var t = (time - startTime) / duration;
      var lerp = 3 * t * t - 2 * t * t * t; // ease in/out
      outerScrollContainer.scrollTo(0, (1.0 - lerp) * start + lerp * target);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // The Y coordinate of the bottom end of all the story content, used
  // for growing the container, and deciding how far to scroll.
  function contentBottomEdgeY() {
    var bottomElement = storyContainer.lastElementChild;
    return bottomElement
      ? bottomElement.offsetTop + bottomElement.offsetHeight
      : 0;
  }

  // Remove all elements that match the given selector. Used for removing choices after
  // you've picked one, as well as for the CLEAR and RESTART tags.
  function removeAll(selector) {
    var allElements = storyContainer.querySelectorAll(selector);
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      el.parentNode.removeChild(el);
    }
  }

  // Used for hiding and showing the header when you CLEAR or RESTART the story respectively.
  function setVisible(selector, visible) {
    var allElements = storyContainer.querySelectorAll(selector);
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      if (!visible) el.classList.add("invisible");
      else el.classList.remove("invisible");
    }
  }

  // Helper for parsing out tags of the form:
  //  # PROPERTY: value
  // e.g. IMAGE: source path
  function splitPropertyTag(tag) {
    var propertySplitIdx = tag.indexOf(":");
    if (propertySplitIdx != null) {
      var property = tag.substr(0, propertySplitIdx).trim();
      var val = tag.substr(propertySplitIdx + 1).trim();
      return {
        property: property,
        val: val,
      };
    }

    return null;
  }
})(storyContent);

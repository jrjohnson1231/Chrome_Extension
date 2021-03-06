(function (chrome) {
  var emoji_map = {
    "anger": [":anger:", ":triumph:", ":angry:"],
    "disgust": [":mask:", ":face_with_rolling_eyes:"],
    "fear": [":fearful:", ":cold_sweat:", ":skull:"],
    "joy": [":grinning:", ":smile:", ":blush:"],
    "sadness": [":slightly_frowning_face:"],
    "analytical": [":thinking_face:", ":sleuth_or_spy:"],
    "confident": [":muscle:", ":sunglasses:"],
    "tentative": [":sweat_smile:", ":zipper_mouth_face:", ":no_mouth:"],
    "openness": [":hugging_face:"],
    "conscientiousness": [":sleuth_or_spy:"],
    "extraversion": [":v:", ":hugging_face:"],
    "agreeableness": [":+1:", ":fist:", ":hearts:"]
  }
  var popup_emoji = {
    "anger": "em em-angry",
    "disgust": "em em-unamused",
    "fear": "em em-fearful",
    "joy": "em em-blush",
    "sadness": "em em-cry",
    "analytical": "em em-notebook",
    "confident": "em em-muscle",
    "tentative": "em em-no_mouth",
    "openness": "em em-grinning",
    "default": "em em-neutral_face"
  }

  function evaluateFeed() {
    console.log('evaluating feed');

    for (mood in popup_emoji) {
      current_mood[mood] = 0;
    }

    $(function()  {
      current_user = $('span.current_user_name').text();

      $('a').click(function() {
        evaluateFeed();
      })

      let in_feed = [];

      $('.message_content').each(function(index) {

        var sender = $(this).children('a.message_sender').attr('href').split('/').slice(-1)[0];
        var message = $(this).children('span.message_body').text().replace(/:[a-zA-Z0-9|+|_|-]+:/ig, '');
        in_feed.push(sender);

        if(!people[sender]) {
          people[sender] = {messages: message};
        } else {
          people[sender].messages += (' ' + message);
        }
      });

      for (let person in people) {
        if (in_feed.indexOf(person) < 0) {
          delete people[person];
        }
      }

      var total = 0;
      for (let person in people) {
        total += people[person].messages.length;
      }

      for (let person in people) {
        console.log('# of people:', Object.keys(people).length);
        makeRequest(people[person].messages).then(function(data) {
          people[person].data = handleData(data).map(function(tone) {
            if (tone.category == 'social') {
              tone.score *= .72;
            }
            return tone;
          });;

          var max = .3;
          var mood = 'default';
          people[person].data.forEach(function(tone) {
            if (!popup_emoji[tone.tone_name]) return;
            current_mood[tone.tone_name] += +tone.score * people[person].messages.length;
            if (tone.score > max) {
              max = +tone.score;
              mood = tone.tone_name;
            }
          })
          people[person].mood = popup_emoji[mood];

          for (m in current_mood) {
            current_mood[m] /= total;
          }

          console.log('done evaluating')

        });
      }

    });
  }

  function handleData(data) {
    return data.document_tone.tone_categories.map(function(category) {
      return category.tones.map(function(tone) {
        tone.category = category.category_name.split(' ')[0].toLowerCase();
        tone.tone_name = tone.tone_name.toLowerCase();
        delete tone.tone_id;
        return tone;
      });
    }).reduce(function(res, cur) {
      Array.prototype.push.apply(res, cur);
      return res;
    });
  }

  function makeRequest (data) {
    return $.ajax({
      url: '//ndhacks2016.herokuapp.com/tone', 
      type: 'POST', 
      contentType: 'application/json', 
      data: JSON.stringify({text: data}),
    }).promise()
  }

  function handler(data) {
    return Rx.Observable.fromPromise(makeRequest(data));
  }

  var people = {};
  var current_mood = {};
  var current_user = undefined;
  var current_
  evaluateFeed();

  var textInput = document.querySelector('#message-input');
  var throttledInput = Rx.DOM.keyup(textInput)
  .pluck('target','value')
  .filter( function (text) {
    if (text.length == 0) {
      evaluateFeed();
    }
    return text.length > 2;
  }) 
  .debounce(500)
  .distinctUntilChanged();

  var output = throttledInput.flatMapLatest(handler)

  output.subscribe(function (data) {
    data = data.document_tone.tone_categories.map(function(category) {
      return category.tones.map(function(tone) {
        tone.category = category.category_name.split(' ')[0].toLowerCase();
        tone.tone_name = tone.tone_name.toLowerCase();
        delete tone.tone_id;
        return tone;
      });
    }).reduce(function(res, cur) {
      Array.prototype.push.apply(res, cur);
      return res;
    }).filter(function(tone) {
      if (tone.category == 'social') {
        tone.score *= .72;
      }
      return +tone.score > .7 && tone.tone_name != 'emotional range';
    });
    if (!data.length) return;
    var r = Math.floor(Math.random() * data.length);
    var tone = emoji_map[data[r].tone_name];
    if (!tone) return;
    var r2 = Math.floor(Math.random() * tone.length);


    textInput.value += (" " + tone[r2]);
  }, function (e) {
    console.log(e);
  });

  // this tab should have a page-action
  chrome.runtime.sendMessage({
    from:    'content',
    subject: 'showPageAction'
  });

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener(function (msg, sender, response) {
    // First, validate the message's structure
    if ((msg.from === 'popup') && (msg.subject === 'DOMInfo')) {
      // Collect the necessary data 
      // (For your specific requirements `document.querySelectorAll(...)`
      //  should be equivalent to jquery's `$(...)`)
      // Directly respond to the sender (popup), 
      // through the specified callback */
      var in_feed = {};
      $('.message_content').each(function(index) {

        var sender = $(this).children('a.message_sender').attr('href').split('/').slice(-1)[0];

        in_feed[sender] = {};
      });

      for (person in people) {
        if (in_feed[person] !== undefined) {
          in_feed[person] = people[person];
        }
      }

      max = .2;
      mood = "default";
      for (m in current_mood) {
        if (current_mood[m] > max) {
          max = current_mood[m];
          mood = m;
        }
      }
      people = in_feed;
      var m;
      if (current_user && in_feed[current_user] !== undefined) {
        m = in_feed[current_user].mood;
      } else {
        m = popup_emoji["default"]
      }
      var input = {
        people: in_feed,
        current_mood: popup_emoji[mood],
        current_user: m
      }
      console.log(input)
      response(input);
    }
  });
}(chrome));

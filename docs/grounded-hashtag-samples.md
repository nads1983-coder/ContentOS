# Grounded hashtag regression outputs

These are actual final parser/formatter outputs from mocked provider responses,
not new live AI generations. The briefs are the three owner-reported examples.
The prose and raw candidates are synthetic fixtures, not claimed original
provider captures. Identical platform prose deliberately isolates allocation.

## A: Why I love YouTube

Facebook, LinkedIn and YouTube each produce this complete caption independently:

```text
There is always another perspective to explore.

That is what I love about YouTube.

#YouTube #OnlineVideo #VideoContent #VideoDiscovery #DigitalMedia
```

Additional suggestions:

```text
#WhyILoveYouTube #YouTubeVideos #VideoSharing #DigitalContent #OnlineContent
```

The raw caption had only `#YouTube`; the raw additional set repeated it and
included `#WhyILoveYouTube`. The existing supported conceptual fallback supplies
the remaining choices. Caption allocation is identical without the optional set.

## B: Why are hashtags not working on my posts?

LinkedIn:

```text
Hashtags are not the whole strategy.

What is the post saying, and who is it for? Those questions deserve attention too.

#LinkedInTips #ContentStrategy #SocialMediaMarketing #LinkedInGrowth
```

Additional field:

```text
No additional relevant hashtags beyond those in your posts.
```

This deliberately minimal raw response supplied only `#Hashtags`. Four supported
caption candidates survive; there are no unused supported alternatives. We do
not invent five extra tags to satisfy a quota. The question is not interpreted
as an instruction to omit hashtags.

## C: Why do I love the different coloured lights in my room so much?

Instagram, LinkedIn and TikTok each produce this complete caption independently:

```text
Same room, different colours.

There is something lovely about coloured lighting. Room lighting can be part of the atmosphere, not just the background.

#RoomLighting #ColouredLights #Lighting #ColourfulLighting #RoomLights
```

Additional suggestions:

```text
#ColourfulLights #ColouredLighting #LightingIdeas #RoomLightingInspiration #ColourfulRoom
```

The formerly rejected `#RoomLighting` and inflections now survive. Unrelated
`#GorlLead`, `#papercraft`, `#Giveaway` and unsupported `#LEDStripLights` do not.
The misleading missing-subject confirmation is removed. Caption allocations
remain the same when the optional Hashtags format is not selected.

## Evidence and limitations

- Tests use the actual generation parser, quality filter, caption-first
  allocator, workspace serializer and shared copy/export formatter.
- Browser tests exercise real clipboard contents, edit/undo, caption and
  additional-set refinement, save/restore and TXT export, with mocked network
  responses and synthetic account storage.
- All three examples retain unchanged fixture prose; this is not evidence that
  a live model will produce these particular sentences or candidates.
- Up to five is a preference, not a guarantee. Lexical grounding is conservative
  and does not establish unlimited semantic synonyms or independently verify
  factual claims. Existing publication-safety checks remain in place.

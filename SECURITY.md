<!--
SPDX-FileCopyrightText: 2026 TorrPlay

SPDX-License-Identifier: MIT
-->

# Security policy

## Supported versions

Security fixes go into the next
[release](https://github.com/torrplay/lampa-plugin/releases), and an older
release is not patched separately. The plugin address published with the
project always serves the latest release, so Lampa picks a fix up the next
time it starts; the development channel gets it as soon as it is merged. A
self-hosted copy of the script keeps running whatever version was copied, so
replace it after a fix is released.

## Reporting a vulnerability

Report a vulnerability privately, through GitHub's [private vulnerability
reporting](https://github.com/torrplay/lampa-plugin/security/advisories/new),
not in a public issue, pull request or discussion. If that form is
unavailable to you, contact a maintainer directly through the contact details
on their GitHub profile, or open an issue that asks for a private channel and
leaves the details out of it.

A useful report includes:

- the plugin version, build date and commit, shown in Lampa under
  Settings → TorrPlay → About Plugin;
- the platform (Android TV, Tizen, webOS or a desktop browser), the device
  and the Lampa build;
- the settings involved, such as the authentication mode and playback mode,
  with every secret removed;
- the steps or the server response that trigger the problem, and what
  happened;
- what an attacker gains, and what they need first, such as control of a
  TorrPlay instance, a search provider, or another plugin loaded in the same
  Lampa.

Leave out passwords, tokens, provider API keys and private instance
addresses, yours or anyone else's. If a torrent or search result is involved,
a minimal fictional one that reproduces the problem is more useful than a
real release's.

You will get an acknowledgment, then an assessment of whether the report is
accepted. An accepted report is fixed in a release and disclosed in a GitHub
security advisory, which credits you unless you ask otherwise. Please keep the
details private until that advisory is published.

A vulnerability in the TorrPlay server itself belongs to the
[TorrPlay project](https://github.com/torrplay/torrplay); report it to that
project privately, not here and not in a public issue.

## Scope

In scope is anything that lets data the plugin receives do more than display
or play what it describes. Torrent names, file lists, search results and
server responses come from TorrPlay instances, Jackett or Prowlarr providers,
trackers and TMDB, none of which the plugin trusts with Lampa itself. For
example:

- script injection through a torrent title, file name, search result, tag or
  error message rendered in Lampa's interface;
- an instance password, bearer token, playback token or provider API key
  being sent to a host other than the instance or provider it belongs to, or
  appearing in a notification or a log line;
- an instance password or bearer token being stored in plain text, when
  passwords are stored obfuscated and bearer tokens live only in memory;
- a response from one instance or provider changing the configuration of
  another, or of the plugin, without the user's action;
- a crafted response that hangs or crashes Lampa.

Out of scope:

- reading credentials from `Lampa.Storage` on the device itself, by another
  plugin or by someone with access to the device; the stored passwords are
  obfuscated against casual inspection, not encrypted, as the README
  explains, and provider URLs and API keys are also copied in plain text to
  Lampa's own Jackett and Prowlarr settings so other extensions keep working;
- the playback token carried in the stream URL, which goes wherever the URL
  goes by design: to an external player, and into Lampa's own watch history;
- an instance or provider reached over plain HTTP, which the user chose when
  adding it;
- an attacker who already controls the TorrPlay instance or search provider
  the user configured, for anything beyond the cases listed as in scope, such
  as serving a different stream or wrong search results;
- vulnerabilities in Lampa, in the TorrPlay server, in Jackett, Prowlarr or a
  tracker, which belong to their own projects;
- findings from automated scanners with no demonstrated impact;
- anything about the content a tracker indexes.

# Change Log
All notable changes to this project will be documented in this file.

## v.next

### Fixed

- Fixed issue where some internal event handlers were not marked as internal,
which caused them to be lost when a user requested that all handlers be
removed from the event.

## 2.0.0 - 2016-01-18

This version adds preliminary support for browser <-> browser renegotiation.
A few edge cases remain that will still need to be addressed, but the
foundation is firmly laid and most same browser renegotiation scenarios work.

### Added

- A 'remote-media-received' event will now be fired on the `Call` object any
time new remote media is added to a call. This event will overlap with the
'connect' event upon receiving the first remote media, but only
'remote-media-received' will be fired upon receiving new media due to
renegotiation.

- The param `onRemoteMedia` may now be passed when starting a call to register
a 'remote-media-received' event handler.

- The following methods (marked in the JSDoc as *private* for now) have been
added to instances of the `Call` object to support renegotiating media:

    - `call.addVideo()` allows you to add video,
    - `call.removeVideo()` allows you to remove video,
    - `call.addAudio()` allows you to add audio, and
    - `call.removeAudio()` allows you to remove audio.

    If the call's media is not in the correct state for the method when called,
it will automatically resolve the returned promise.

    These methods will be marked public in the JSDoc and be available in the
published documentation once we feel the feature is more stable and ready for
general use. Until then, documentation is available in the source.

### Changed

- `LocalMedia` (outgoing) streams are no longer automatically reused between
calls. If this functionality is required or desired, the `outgoingMedia`
param should be set when starting a new call, passing in a started `LocalMedia`
instance.

### Removed

- `respoke.streams` (where existing streams were previously "cached") has been
removed, because it was not able to differentiate between two streams obtained
using the same constraints.

- Revoking permission to a stream, thereby stopping the stream, no longer
automatically hangs up the call if it was the only stream left on the call. This
functionality was interfering with renegotiation because prior to re-offering
in Chrome, you must stop and remove a stream prior to adding the new stream.
This was most noticable when performing a screen share and then pressing the
"Stop Sharing" button that Chrome shows while sharing your screen. For anyone
that was relying on this functionality, it can still be emulated by listening
to the 'stop' event on their `LocalMedia` instance. In the handler, a check can
be done against the call's `outgoingMediaStreams` and `incomingMediaStreams` to
see if they are empty, and hangup the call if so.

---

*For more information about keeping a changelog, check out [keepachangelog.com/](http://keepachangelog.com/)*

# Implementation Plan — Change 6: Username & Friends System

## Overview
This plan implements a required username system for signed-in users and a one-way friendships (following) system with search and leaderboard tabs.

---

## User Review Required

> [!IMPORTANT]
> **Existing Users Force-Setup**: Users who already created an account (and profile doc) but do not have a username will be prompted with a blocking `UsernameSetupModal` on their first visit, preventing access to any other pages until they choose a valid, unique username.
> 
> **Username Rules**:
> - 3 to 20 characters
> - Only letters, numbers, and underscores (`/^[a-zA-Z0-9_]{3,20}$/`)
> - Unique across all users (verified case-insensitively by storing a lowercase mapping in the `usernames` collection)

---

## Open Questions

> [!NOTE]
> **Case Sensitivity**: The lookup document keys in the `usernames` collection will be lowercased to prevent users from claiming usernames that differ only in casing (e.g. if `tourist` is taken, `Tourist` cannot be claimed). The user profile will preserve the original casing they typed.

---

## Proposed Changes

### Database Layer & Config

#### [MODIFY] [firestore.rules](file:///d:/CPtracker/firestore.rules)
- Add rules for `usernames/{username}`:
  - `allow read: if true;`
  - `allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;`
  - `allow delete: if isAuthenticated() && resource.data.uid == request.auth.uid;`
- Add rules for `friendships/{userId}/friends/{friendId}`:
  - `allow read, write: if isOwner(userId);`

#### [MODIFY] [types/index.ts](file:///d:/CPtracker/src/types/index.ts)
- Add `username?: string` to `UserProfile`.
- Define `UsernameDoc` and `Friendship` interfaces.

---

### Core Services & Hooks

#### [NEW] [usernameService.ts](file:///d:/CPtracker/src/services/usernameService.ts)
- `checkUsernameAvailable(username: string): Promise<boolean>`
- `claimUsername(uid: string, username: string, oldUsername?: string): Promise<void>`
  - Uses Firestore transaction to read `usernames/{username.toLowerCase()}`.
  - If taken, throws an error.
  - If available, sets `usernames/{username.toLowerCase()}` to `{ uid }`, deletes the old username doc if `oldUsername` is provided, and updates the user's profile doc in `users/{uid}`.

#### [NEW] [friendService.ts](file:///d:/CPtracker/src/services/friendService.ts)
- `addFriend(uid: string, friendUid: string): Promise<void>`
- `removeFriend(uid: string, friendUid: string): Promise<void>`
- `searchUsersByUsername(query: string): Promise<UserProfile[]>`
  - Performs prefix search on `users` collection: `where('username', '>=', query).where('username', '<=', query + '\uf8ff')`.

#### [NEW] [useFriends.ts](file:///d:/CPtracker/src/hooks/useFriends.ts)
- Custom React hook subscribing to `/friendships/{uid}/friends` in real-time.
- Exposes `friendUids`, `addFriend`, `removeFriend`, and `loading`.

---

### Authentication & Onboarding

#### [MODIFY] [AuthContext.tsx](file:///d:/CPtracker/src/context/AuthContext.tsx)
- Expose `needsUsername` boolean (true if user is logged in, profile exists, but `profile.username` is missing).
- Adjust `completeOnboarding` to require a `username`, check its validity, and claim it during creation.

#### [MODIFY] [OnboardingModal.tsx](file:///d:/CPtracker/src/components/OnboardingModal.tsx)
- Add Username input field at the top of onboarding form.
- Implement debounced real-time check showing green checkmark / red X.
- Block submit button until a valid, unique username is validated.

#### [NEW] [UsernameSetupModal.tsx](file:///d:/CPtracker/src/components/UsernameSetupModal.tsx)
- Blocking modal overlay for existing users who are logged in but lack a username.
- Shows input field, "Check availability" status, and a button to save.

#### [NEW] [EditUsernameModal.tsx](file:///d:/CPtracker/src/components/EditUsernameModal.tsx)
- Modal accessible from the Dashboard to let users change their username.
- Performs uniqueness check, deletes old username doc, and updates new username.

---

### UI & Navigation

#### [MODIFY] [DashboardPage.tsx](file:///d:/CPtracker/src/pages/DashboardPage.tsx)
- Display username instead of displayName in the profile header.
- Add an "Edit Username" button/icon in the header to open `EditUsernameModal`.
- Render `UsernameSetupModal` if `needsUsername` is true.

#### [NEW] [FriendsPage.tsx](file:///d:/CPtracker/src/pages/FriendsPage.tsx)
- Route: `/friends`.
- Contains a search bar at the top to look up other users by username.
- Displays matching users (avatar, username, rank badge, total solves) with "Add friend" / "Remove friend" button.
- Lists currently added friends with streak, total solves, and a "Remove" button.
- Shows empty state: "Search for friends by username to add them".

#### [MODIFY] [LeaderboardPage.tsx](file:///d:/CPtracker/src/pages/LeaderboardPage.tsx)
- Update tab options: "🌐 Global", "👥 Friends", "🏢 Group".
- Friends tab: Filters leaderboard to show only the user's friends + the user themselves, sorted by period XP.
- Add a search bar inside the leaderboard page to easily add/remove friends without leaving.
- Render usernames instead of displayNames.

#### [MODIFY] [GroupDetailPage.tsx](file:///d:/CPtracker/src/pages/GroupDetailPage.tsx)
- Render usernames instead of displayNames for group members.

#### [MODIFY] [App.tsx](file:///d:/CPtracker/src/App.tsx)
- Add `/friends` route mapping to `FriendsPage`.

#### [MODIFY] [NavBar.tsx](file:///d:/CPtracker/src/components/NavBar.tsx)
- Add "Friends" link to the nav.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify there are 0 TypeScript and compile errors.

### Manual Verification
1. **New User Onboarding**: Sign up as a new user, verify username field is required, check real-time availability check, verify it fails for duplicate usernames or usernames that don't match rules (like < 3 chars), verify successful creation.
2. **Existing User Upgrade**: Log in with an account that has a profile doc but no username. Verify that a blocking setup modal forces choosing a username and no other pages can be navigated to.
3. **Change Username**: Go to the dashboard settings, edit username, verify it correctly deletes the old mapping in Firestore, creates the new mapping, and updates profile.
4. **Friends Search & Add**: Navigate to `/friends`, search by username prefix, add a friend, verify button text changes to "Remove", verify friends list updates.
5. **Friends Leaderboard**: Select the "Friends" tab on `/leaderboard`, verify only you and your friends are shown, and the rank/XP periods work correctly.
6. **Group & Solve Feeds**: Verify that username is displayed instead of displayName in group details.

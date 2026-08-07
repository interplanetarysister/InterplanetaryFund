/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type CommunityProps = {
  userId: string;
};

export default function Community({ userId }: CommunityProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateDiscussion, setShowCreateDiscussion] = useState(false);

  // Group state
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupCategory, setGroupCategory] = useState("General");

  // Discussion state
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionContent, setDiscussionContent] = useState("");

  // Reply state
  const [replyContent, setReplyContent] = useState("");
  const [activeDiscussion, setActiveDiscussion] = useState<string | null>(null);

  const groups = useQuery(api.community.getGroups, {});
  const joinedGroups = useQuery(api.community.getJoinedGroups, { userId });
  const discussions = useQuery(
    api.community.getDiscussions,
    selectedGroup ? { groupId: selectedGroup } : "skip"
  );
  const replies = useQuery(
    api.community.getReplies,
    activeDiscussion ? { discussionId: activeDiscussion } : "skip"
  );

  const createGroup = useMutation(api.community.createGroup);
  const joinGroup = useMutation(api.community.joinGroup);
  const leaveGroup = useMutation(api.community.leaveGroup);
  const createDiscussion = useMutation(api.community.createDiscussion);
  const replyToDiscussion = useMutation(api.community.replyToDiscussion);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || !groupDescription.trim()) return;
    await createGroup({
      name: groupName,
      description: groupDescription,
      category: groupCategory,
      createdBy: userId,
    });
    setGroupName("");
    setGroupDescription("");
    setShowCreateGroup(false);
  };

  const handleCreateDiscussion = async () => {
    if (!discussionTitle.trim() || !discussionContent.trim() || !selectedGroup) return;
    await createDiscussion({
      groupId: selectedGroup,
      authorId: userId,
      authorName: "You",
      title: discussionTitle,
      content: discussionContent,
    });
    setDiscussionTitle("");
    setDiscussionContent("");
    setShowCreateDiscussion(false);
  };

  const handleReply = async (discussionId: string) => {
    if (!replyContent.trim()) return;
    await replyToDiscussion({
      discussionId,
      authorId: userId,
      authorName: "You",
      content: replyContent,
    });
    setReplyContent("");
  };

  const isJoined = (groupId: string) => {
    return joinedGroups?.some((g: any) => g && g._id === groupId) ?? false;
  };

  const categories = ["All", "General", "Fundraising", "Medical", "Education", "Community", "Animals", "Environment"];

  // === DISCUSSION THREAD VIEW ===
  if (activeDiscussion && discussions) {
    const discussion = discussions.find((d: any) => d._id === activeDiscussion);

    return (
      <div className="space-y-4">
        <button onClick={() => setActiveDiscussion(null)} className="text-xs text-ifmuted">
          ← Back to discussions
        </button>

        {discussion && (
          <div className="card space-y-2">
            <h3 className="text-sm font-bold text-iftext">{discussion.title}</h3>
            <p className="text-xs text-ifmuted">{discussion.content}</p>
            <p className="text-[10px] text-ifmuted">By {discussion.authorName} · {new Date(discussion.createdAt).toLocaleDateString()}</p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-iftext">Replies ({replies?.length || 0})</h4>
          {replies?.map((r: any) => (
            <div key={r._id} className="card">
              <p className="text-xs text-iftext">{r.content}</p>
              <p className="text-[10px] text-ifmuted mt-1">By {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
          {replies && replies.length === 0 && (
            <p className="text-xs text-ifmuted text-center py-4">No replies yet. Start the conversation!</p>
          )}
        </div>

        <div className="card space-y-2">
          <textarea
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="input-field min-h-[80px]"
          />
          <button
            onClick={() => handleReply(activeDiscussion)}
            disabled={!replyContent.trim()}
            className="w-full py-2.5 rounded-xl bg-ifaccent text-white text-sm font-semibold disabled:opacity-40"
          >
            Post Reply
          </button>
        </div>
      </div>
    );
  }

  // === GROUP DETAIL VIEW ===
  if (selectedGroup) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedGroup(null)} className="text-xs text-ifmuted">
          ← Back to groups
        </button>

        {groups?.filter((g: any) => g._id === selectedGroup).map((g: any) => (
          <div key={g._id} className="card space-y-3">
            <div>
              <h3 className="text-sm font-bold text-iftext">{g.name}</h3>
              <span className="px-2 py-0.5 rounded-full bg-ifaccent/20 text-ifaccent text-[10px]">{g.category}</span>
            </div>
            <p className="text-xs text-ifmuted">{g.description}</p>
            <p className="text-[10px] text-ifmuted">{g.memberCount} members</p>

            {!isJoined(g._id) ? (
              <button
                onClick={() => joinGroup({ groupId: g._id, userId })}
                className="w-full py-2.5 rounded-xl bg-ifaccent text-white text-sm font-semibold"
              >
                Join Group
              </button>
            ) : (
              <button
                onClick={() => leaveGroup({ groupId: g._id, userId })}
                className="w-full py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm font-medium"
              >
                Leave Group
              </button>
            )}
          </div>
        ))}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-iftext">Discussions</h3>
            {isJoined(selectedGroup) && (
              <button onClick={() => setShowCreateDiscussion(!showCreateDiscussion)} className="text-xs text-ifaccent">
                + New
              </button>
            )}
          </div>

          {showCreateDiscussion && (
            <div className="card space-y-2">
              <input
                type="text"
                placeholder="Discussion title"
                value={discussionTitle}
                onChange={(e) => setDiscussionTitle(e.target.value)}
                className="input-field"
              />
              <textarea
                placeholder="Share your thoughts..."
                value={discussionContent}
                onChange={(e) => setDiscussionContent(e.target.value)}
                className="input-field min-h-[100px]"
              />
              <button onClick={handleCreateDiscussion} className="w-full py-2.5 rounded-xl bg-ifaccent text-white text-sm font-semibold">
                Post Discussion
              </button>
            </div>
          )}

          {discussions?.map((d: any) => (
            <button
              key={d._id}
              onClick={() => setActiveDiscussion(d._id)}
              className="card w-full text-left active:scale-[0.99] transition-transform"
            >
              <p className="text-sm font-semibold text-iftext">{d.title}</p>
              <p className="text-xs text-ifmuted mt-1 line-clamp-2">{d.content}</p>
              <div className="flex justify-between mt-2 text-[10px] text-ifmuted">
                <span>By {d.authorName}</span>
                <span>{d.replyCount} replies</span>
              </div>
            </button>
          ))}
          {discussions && discussions.length === 0 && (
            <div className="card text-center py-6">
              <p className="text-xs text-ifmuted">No discussions yet. Start one!</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === GROUP LIST VIEW ===
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-iftext">Community Groups</h3>
        <button onClick={() => setShowCreateGroup(!showCreateGroup)} className="text-xs text-ifaccent">
          + Create
        </button>
      </div>

      {showCreateGroup && (
        <div className="card space-y-3">
          <h4 className="text-sm font-semibold text-iftext">New Group</h4>
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="input-field"
          />
          <textarea
            placeholder="What is this group about?"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            className="input-field min-h-[60px]"
          />
          <select value={groupCategory} onChange={(e) => setGroupCategory(e.target.value)} className="input-field">
            <option>General</option>
            <option>Fundraising</option>
            <option>Medical</option>
            <option>Education</option>
            <option>Community</option>
            <option>Animals</option>
            <option>Environment</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleCreateGroup} className="btn-primary flex-1">Create</button>
            <button onClick={() => setShowCreateGroup(false)} className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Joined groups first */}
      {joinedGroups && joinedGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-ifmuted uppercase tracking-wide">Your Groups</p>
          {joinedGroups.filter(Boolean).map((g: any) => (
            <GroupCard key={g._id} group={g} joined onClick={() => setSelectedGroup(g._id)} />
          ))}
        </div>
      )}

      {/* All groups */}
      <div className="space-y-2">
        <p className="text-[10px] text-ifmuted uppercase tracking-wide">All Groups</p>
        {!groups && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {groups?.length === 0 && (
          <div className="card text-center py-6">
            <p className="text-xs text-ifmuted">No groups yet. Create the first one!</p>
          </div>
        )}
        {groups?.map((g: any) => (
          <GroupCard key={g._id} group={g} joined={isJoined(g._id)} onClick={() => setSelectedGroup(g._id)} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({ group, joined, onClick }: { group: any; joined: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card w-full text-left active:scale-[0.99] transition-transform">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-iftext">{group.name}</p>
          <span className="px-2 py-0.5 rounded-full bg-ifaccent/20 text-ifaccent text-[10px]">{group.category}</span>
        </div>
        {joined && <span className="px-2 py-0.5 rounded-full bg-ifgreen/20 text-ifgreen text-[10px]">Joined</span>}
      </div>
      <p className="text-xs text-ifmuted mt-1 line-clamp-2">{group.description}</p>
      <p className="text-[10px] text-ifmuted mt-1">{group.memberCount} members</p>
    </button>
  );
}

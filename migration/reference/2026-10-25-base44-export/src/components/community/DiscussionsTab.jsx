import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PostCard from "./PostCard";
import { Loader2 } from "lucide-react";

const categories = [
  { value: "question", label: "Question" },
  { value: "announcement", label: "Announcement" },
  { value: "idea", label: "Idea" },
  { value: "success_story", label: "Success Story" },
  { value: "coordination", label: "Coordination" },
  { value: "support", label: "Support" },
];

export default function DiscussionsTab({ communityId, isMember }) {
  const [posts, setPosts] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("question");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    base44.entities.DiscussionPost.filter({ community_id: communityId }, "-created_date", 50).then(setPosts);
  }, [communityId]);

  const publish = async () => {
    setPosting(true);
    const { data } = await base44.functions.invoke("createDiscussionPost", { community_id: communityId, title, content, category });
    if (data?.ok !== true || !data?.post) throw new Error("Discussion post rejected");
    const post = data.post;
    setPosts((prev) => [post, ...(prev || [])]);
    setTitle("");
    setContent("");
    setPosting(false);
  };

  if (!posts) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const sorted = [...posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="space-y-4">
      {isMember && (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 space-y-3">
          <div className="flex gap-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Start a discussion…" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add details (optional)" />
          <Button onClick={publish} disabled={posting || !title.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
          </Button>
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No discussions yet — start the first one.</p>
      ) : (
        sorted.map((p) => <PostCard key={p.id} post={p} isMember={isMember} />)
      )}
    </div>
  );
}
import { supabase } from "@/lib/supabase";

export interface MentorWithRating {
  id: string;
  name: string;
  display_name: string | null;
  mentor_bio: string | null;
  mentor_specialty: string | null;
  mentor_avatar_url: string | null;
  avg_rating: number;
  review_count: number;
}

export interface MentorshipSlot {
  id: string;
  mentor_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

export interface GroupMentorship {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  mentor: {
    name: string;
    display_name: string | null;
    mentor_avatar_url: string | null;
  };
}

export async function listMentorsWithRatings(): Promise<MentorWithRating[]> {
  const { data: mentors, error } = await supabase
    .from("profiles")
    .select("id, name, display_name, mentor_bio, mentor_specialty, mentor_avatar_url")
    .eq("is_mentor", true);

  if (error) throw error;
  if (!mentors || mentors.length === 0) return [];

  const mentorIds = mentors.map((m) => m.id);

  const { data: reviews, error: revError } = await supabase
    .from("mentor_reviews")
    .select("mentor_id, rating")
    .in("mentor_id", mentorIds);

  if (revError) throw revError;

  const ratingMap: Record<string, { sum: number; count: number }> = {};
  for (const r of reviews ?? []) {
    if (!ratingMap[r.mentor_id]) ratingMap[r.mentor_id] = { sum: 0, count: 0 };
    ratingMap[r.mentor_id].sum += r.rating;
    ratingMap[r.mentor_id].count += 1;
  }

  return mentors.map((m) => {
    const stats = ratingMap[m.id] ?? { sum: 0, count: 0 };
    return {
      ...m,
      avg_rating: stats.count > 0 ? Math.round((stats.sum / stats.count) * 10) / 10 : 0,
      review_count: stats.count,
    };
  });
}

export async function getMentorAvailability(mentorId: string): Promise<MentorshipSlot[]> {
  const { data, error } = await supabase
    .from("mentorship_slots")
    .select("id, mentor_id, start_time, end_time, status")
    .eq("mentor_id", mentorId)
    .eq("status", "available")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listGroupMentorships(): Promise<GroupMentorship[]> {
  const { data, error } = await supabase
    .from("group_mentorships")
    .select(
      `id, mentor_id, title, description, start_time, end_time, max_capacity, current_bookings,
       mentor:profiles!group_mentorships_mentor_id_fkey(name, display_name, mentor_avatar_url)`
    )
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    const mentorRaw = Array.isArray(r.mentor) ? r.mentor[0] : r.mentor;
    const mentor = (mentorRaw ?? {}) as { name: string; display_name: string | null; mentor_avatar_url: string | null };
    return {
      id: r.id as string,
      mentor_id: r.mentor_id as string,
      title: r.title as string,
      description: r.description as string | null,
      start_time: r.start_time as string,
      end_time: r.end_time as string,
      max_capacity: r.max_capacity as number,
      current_bookings: r.current_bookings as number,
      mentor,
    };
  });
}

export async function updateMentorProfile(
  uid: string,
  data: {
    is_mentor?: boolean;
    mentor_bio?: string | null;
    mentor_specialty?: string | null;
    mentor_avatar_url?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("profiles").update(data).eq("id", uid);
  if (error) throw error;
}

export async function createIndividualSlot(
  mentorId: string,
  startTime: string,
  endTime: string
): Promise<void> {
  const { error } = await supabase.from("mentorship_slots").insert({
    mentor_id: mentorId,
    start_time: startTime,
    end_time: endTime,
    status: "available",
  });
  if (error) throw error;
}

export async function createGroupMentorship(data: {
  mentor_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  max_capacity: number;
}): Promise<void> {
  const { error } = await supabase.from("group_mentorships").insert({
    ...data,
    current_bookings: 0,
  });
  if (error) throw error;
}

export interface AdminSlot extends MentorshipSlot {
  mentor_name: string;
}

export async function listAllSlotsAdmin(): Promise<AdminSlot[]> {
  const { data, error } = await supabase
    .from("mentorship_slots")
    .select(
      `id, mentor_id, start_time, end_time, status,
       mentor:profiles!mentorship_slots_mentor_id_fkey(name, display_name)`
    )
    .order("start_time", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    const mentorRaw = Array.isArray(r.mentor) ? r.mentor[0] : r.mentor;
    const m = (mentorRaw ?? {}) as { name?: string; display_name?: string | null };
    return {
      id: r.id as string,
      mentor_id: r.mentor_id as string,
      start_time: r.start_time as string,
      end_time: r.end_time as string,
      status: r.status as string,
      mentor_name: m.display_name || m.name || "—",
    };
  });
}

export async function deleteIndividualSlot(slotId: string): Promise<void> {
  const { error } = await supabase.from("mentorship_slots").delete().eq("id", slotId);
  if (error) throw error;
}

export interface AdminGroupMentorship {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  mentor_name: string;
}

export async function listAllGroupMentorshipsAdmin(): Promise<AdminGroupMentorship[]> {
  const { data, error } = await supabase
    .from("group_mentorships")
    .select(
      `id, mentor_id, title, description, start_time, end_time, max_capacity, current_bookings,
       mentor:profiles!group_mentorships_mentor_id_fkey(name, display_name)`
    )
    .order("start_time", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    const mentorRaw = Array.isArray(r.mentor) ? r.mentor[0] : r.mentor;
    const m = (mentorRaw ?? {}) as { name?: string; display_name?: string | null };
    return {
      id: r.id as string,
      mentor_id: r.mentor_id as string,
      title: r.title as string,
      description: r.description as string | null,
      start_time: r.start_time as string,
      end_time: r.end_time as string,
      max_capacity: r.max_capacity as number,
      current_bookings: r.current_bookings as number,
      mentor_name: m.display_name || m.name || "—",
    };
  });
}

export async function updateGroupMentorship(
  groupId: string,
  data: {
    title?: string;
    description?: string | null;
    start_time?: string;
    end_time?: string;
    max_capacity?: number;
  }
): Promise<void> {
  const { error } = await supabase.from("group_mentorships").update(data).eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroupMentorship(groupId: string): Promise<void> {
  const { error } = await supabase.from("group_mentorships").delete().eq("id", groupId);
  if (error) throw error;
}

// ── Group participant management ──────────────────────────────────────────────

export interface GroupParticipant {
  id: string;
  name: string;
  avatar_url: string | null;
}

export async function listGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
  const { data, error } = await supabase
    .from("group_mentorship_participants")
    .select(
      `student:profiles!group_mentorship_participants_student_id_fkey(id, name, display_name, avatar_url)`
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    const studentRaw = Array.isArray(r.student) ? r.student[0] : r.student;
    const s = (studentRaw ?? {}) as { id?: string; name?: string; display_name?: string | null; avatar_url?: string | null };
    return {
      id:         s.id ?? "",
      name:       s.display_name?.trim() || s.name?.trim() || "Aluno",
      avatar_url: s.avatar_url ?? null,
    };
  });
}

export async function addStudentToGroup(groupId: string, studentId: string): Promise<void> {
  const { error: insertError } = await supabase
    .from("group_mentorship_participants")
    .insert({ group_id: groupId, student_id: studentId });

  if (insertError) {
    const code = String(insertError.code ?? "");
    if (code.startsWith("23505")) throw new Error("Aluno já confirmado nesta mentoria.");
    throw insertError;
  }
  // current_bookings is kept in sync automatically by the DB trigger (migration 038)
}

export async function removeStudentFromGroup(groupId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from("group_mentorship_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("student_id", studentId);

  if (error) throw error;
  // current_bookings is kept in sync automatically by the DB trigger (migration 038)
}

export interface BookedStudentSlot {
  slotId: string;
  start_time: string;
  end_time: string;
  studentId: string;
  studentName: string;
  studentAvatar: string | null;
  rating?: number;
  comment?: string;
}

export async function listMyBookedStudents(mentorId: string): Promise<BookedStudentSlot[]> {
  // Step 1: booked slots — no FK-join alias to avoid constraint-name fragility
  const { data: slotData, error: slotError } = await supabase
    .from("mentorship_slots")
    .select("id, start_time, end_time, student_id")
    .eq("mentor_id", mentorId)
    .eq("status", "booked")
    .order("start_time", { ascending: true });

  if (slotError) throw slotError;
  if (!slotData || slotData.length === 0) return [];

  // Step 2: student profiles (separate query, no FK name needed)
  const studentIds = [
    ...new Set(
      slotData.map((s) => s.student_id as string | null).filter(Boolean) as string[]
    ),
  ];

  const profileMap: Record<string, { name: string; display_name: string | null; avatar_url: string | null }> = {};
  if (studentIds.length > 0) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, name, display_name, avatar_url")
      .in("id", studentIds);
    for (const p of profileData ?? []) {
      const row = p as { id: string; name: string; display_name: string | null; avatar_url: string | null };
      profileMap[row.id] = row;
    }
  }

  const slots: BookedStudentSlot[] = slotData.map((row) => {
    const studentId = (row.student_id ?? "") as string;
    const profile   = profileMap[studentId] ?? {};
    return {
      slotId:        row.id as string,
      start_time:    row.start_time as string,
      end_time:      row.end_time as string,
      studentId,
      studentName:   (profile.display_name as string | null)?.trim()
                     || (profile.name as string | null)?.trim()
                     || "Aluno",
      studentAvatar: (profile.avatar_url as string | null) ?? null,
    };
  });

  if (studentIds.length === 0) return slots;

  // Step 3: ratings
  const { data: reviews } = await supabase
    .from("mentor_reviews")
    .select("student_id, rating, comment")
    .eq("mentor_id", mentorId)
    .in("student_id", studentIds);

  const reviewMap: Record<string, { rating: number; comment: string }> = {};
  for (const rev of reviews ?? []) {
    const r = rev as { student_id: string; rating: number; comment: string };
    reviewMap[r.student_id] = { rating: r.rating, comment: r.comment };
  }

  return slots.map((slot) => ({
    ...slot,
    ...(reviewMap[slot.studentId] ?? {}),
  }));
}

export async function submitMentorReview(
  mentorId: string,
  studentId: string,
  rating: number,
  comment: string
): Promise<void> {
  const { error } = await supabase.from("mentor_reviews").insert({
    mentor_id: mentorId,
    student_id: studentId,
    rating,
    comment,
  });

  if (error) {
    const code = String(error.code ?? "");
    if (code.startsWith("23505")) {
      const { error: upError } = await supabase
        .from("mentor_reviews")
        .update({ rating, comment })
        .eq("mentor_id", mentorId)
        .eq("student_id", studentId);
      if (upError) throw upError;
      return;
    }
    throw error;
  }
}

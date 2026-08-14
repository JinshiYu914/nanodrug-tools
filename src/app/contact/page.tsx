"use client";

import { useState } from "react";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Send,
  Loader2,
  Mail,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type FeedbackType = "tool_suggestion" | "bug_report" | "improvement";

const feedbackTypes: {
  value: FeedbackType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "tool_suggestion",
    label: "工具建议",
    icon: <Lightbulb className="h-5 w-5" />,
    description: "想要使用新的在线工具",
  },
  {
    value: "bug_report",
    label: "Bug 反馈",
    icon: <Bug className="h-5 w-5" />,
    description: "发现了问题或错误",
  },
  {
    value: "improvement",
    label: "功能改善",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "对现有功能的改进建议",
  },
];

export default function ContactPage() {
  const [feedbackType, setFeedbackType] =
    useState<FeedbackType>("tool_suggestion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("feedback").insert({
        type: feedbackType,
        title,
        content,
        email: email || user?.email || null,
        user_id: user?.id || null,
      });

      if (error) {
        if (error.code === "42P01") {
          throw new Error("反馈功能尚未完成数据库配置，请先应用 011_feedback.sql");
        }
        throw new Error(error.message || "反馈提交失败");
      }

      toast.success("感谢你的反馈！我们会尽快处理。");
      setSubmitted(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "反馈提交失败，请稍后重试或通过右侧邮箱联系我们";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <CardTitle>提交成功</CardTitle>
            <CardDescription>
              感谢你的反馈！我们会认真查看每一条建议。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setSubmitted(false)} variant="outline">
              继续提交
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">联系我们</h1>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>提交反馈</CardTitle>
              <CardDescription>
                选择反馈类型并填写详细信息
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label>反馈类型</Label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {feedbackTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFeedbackType(type.value)}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors ${
                          feedbackType === type.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div
                          className={
                            feedbackType === type.value
                              ? "text-primary"
                              : "text-muted-foreground"
                          }
                        >
                          {type.icon}
                        </div>
                        <span className="text-sm font-medium">
                          {type.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {type.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">标题</Label>
                  <Input
                    id="title"
                    placeholder={
                      feedbackType === "tool_suggestion"
                        ? "例如：希望增加 XX 计算工具"
                        : feedbackType === "bug_report"
                          ? "例如：XX 页面数据显示异常"
                          : "例如：希望 XX 功能可以 ..."
                    }
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">详细描述</Label>
                  <Textarea
                    id="content"
                    placeholder="请详细描述你的建议或遇到的问题..."
                    rows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">
                    联系邮箱{" "}
                    <span className="text-muted-foreground">(选填)</span>
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="方便我们回复你"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      提交反馈
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">联系方式</CardTitle>
              <CardDescription>
                你也可以通过以下方式直接联系我们
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium">微信</p>
                  <Badge variant="secondary" className="mt-1">
                    jinshi914
                  </Badge>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-info" />
                <div>
                  <p className="text-sm font-medium">邮箱</p>
                  <a
                    href="mailto:yujinshi@zju.edu.cn"
                    className="mt-1 text-sm text-primary hover:underline"
                  >
                    yujinshi@zju.edu.cn
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

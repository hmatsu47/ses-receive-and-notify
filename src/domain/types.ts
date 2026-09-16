// ドメイン型定義: 副作用のない純粋レイヤが扱う型。
// I/O 境界 (handler/adapters) はこれらの型へ変換してからドメイン関数を呼ぶ。

/**
 * 型付き結果 (Result)。想定内の失敗は例外ではなく Result で伝播し、
 * 呼び出し側が「保存継続＋ログ可視化」を選択できるようにする (team.md Code Style)。
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** 想定内失敗の分類。ログ相関・分岐判定に使う。 */
export type FailureKind =
  | 'decode-failed'
  | 'attachment-over-limit'
  | 'slack-send-failed'
  | 'invalid-event'
  | 'raw-object-not-found';

export interface DomainFailure {
  readonly kind: FailureKind;
  readonly message: string;
  /** ログ相関に使う非機微な識別子 (objectKey / messageId 等)。PII を含めない。 */
  readonly correlationId?: string;
}

/** 受信メール原本 (1st S3 から取得した raw バイト列 + 参照情報)。 */
export interface ReceivedMail {
  /** raw MIME バイト列。 */
  readonly raw: Buffer;
  /** 1st S3 のバケット/キー (参照情報)。 */
  readonly sourceBucket: string;
  readonly sourceKey: string;
  /** 受信日時 (S3 オブジェクトの LastModified 等から解決)。 */
  readonly receivedAt: Date;
}

/** デコード済みメールの 1 添付。 */
export interface DecodedAttachment {
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  /** 添付本体のバイト列 (2nd S3 へ保管する。FR2.1/FR2.2)。 */
  readonly content: Buffer;
}

/** メールヘッダのうち保存本文先頭に付与するもの (FR2.3)。 */
export interface MailHeaders {
  readonly messageId: string;
  /** エンベロープ From (Return-Path 等)。欠損時は undefined。 */
  readonly envelopeFrom: string | undefined;
  readonly from: string | undefined;
  readonly subject: string | undefined;
}

/** デコード結果。添付上限超過時は decodedAttachments を空にし attachmentsSkipped=true。 */
export interface DecodedMail {
  readonly headers: MailHeaders;
  /** テキスト本文 (プレーンテキスト。HTML のみの場合はテキスト抽出後)。 */
  readonly textBody: string;
  /** 元がプレーンテキストだったか (要約整形の分岐用)。 */
  readonly hadPlainText: boolean;
  readonly attachments: readonly DecodedAttachment[];
  /** 添付合計サイズ (バイト)。上限判定・ログに使用。 */
  readonly totalAttachmentBytes: number;
  /** 添付合計が上限超過でデコードをスキップしたか (FR2.4)。 */
  readonly attachmentsSkipped: boolean;
}

/** Slack Incoming Webhook へ送るペイロード (FR3.2)。 */
export interface SlackPayload {
  /** サニタイズ済みの通知本文 (mrkdwn)。 */
  readonly text: string;
}

/** 実行時設定 (秘匿値含む)。ソースにハードコードしない (FR4.1)。 */
export interface Config {
  readonly targetDomain: string;
  readonly slackWebhookUrl: string;
  readonly rawMailBucket: string;
  readonly decodedMailBucket: string;
  readonly attachmentTotalLimitBytes: number;
  readonly region: string | undefined;
}

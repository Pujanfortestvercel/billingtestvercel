// ---------------------------------------------------------------------------
// STOREFRONT UNLOCK CARD COMPONENT
// ---------------------------------------------------------------------------
// Unlocks when the shopkeeper adds 40 or more items to their catalog!
// Displays progress towards 40 items, or the unlocked shareable public store URL.
// ---------------------------------------------------------------------------
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Card, Button } from './UI';

type StorefrontUnlockCardProps = {
  itemCount: number;
};

export function StorefrontUnlockCard({ itemCount }: StorefrontUnlockCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  if (!user) return null;

  const isUnlocked = itemCount >= 40;
  const progressPercent = Math.min(100, Math.round((itemCount / 40) * 100));

  // Construct current domain store link
  const storeUrl = `${window.location.origin}/store/${user.id}`;

  function copyStoreUrl() {
    navigator.clipboard.writeText(storeUrl);
    toast('Public store link copied to clipboard! 📋', 'success');
  }

  function shareStoreWhatsApp() {
    const msg = `🛒 *Check out our online catalog & place direct orders!*\n\nView items, live stock, and order directly:\n👉 ${storeUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <Card
      style={{
        marginBottom: 18,
        border: isUnlocked ? '2px solid var(--primary)' : '1px solid var(--border)',
        background: isUnlocked ? 'var(--primary-soft)' : 'var(--surface)',
      }}
    >
      {!isUnlocked ? (
        <div>
          <div className="row spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 16 }}>🚀 Unlock Your Public Online Store Link!</strong>
              <p className="muted" style={{ margin: 0, marginTop: 2, fontSize: 13 }}>
                Add <strong>40 or more items</strong> to automatically unlock a public digital catalog link for your customers.
              </p>
            </div>
            <span className="badge badge-warning" style={{ fontSize: 13, fontWeight: 700 }}>
              {itemCount} / 40 Items Added
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: 12 }}>
            <div style={{ background: 'var(--border)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  background: 'var(--primary)',
                  height: '100%',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4, textAlign: 'right' }}>
              Add <strong>{40 - itemCount}</strong> more item{40 - itemCount === 1 ? '' : 's'} to unlock!
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="row spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🎉</span>
                <strong style={{ fontSize: 17, color: 'var(--primary)' }}>Public Storefront Unlocked!</strong>
              </div>
              <p className="muted" style={{ margin: 0, marginTop: 2, fontSize: 13 }}>
                Your customers can now view your live inventory stock and place direct orders on WhatsApp!
              </p>
            </div>
            <span className="badge badge-success" style={{ fontSize: 13, fontWeight: 800 }}>
              ✨ UNLOCKED (40+ Items)
            </span>
          </div>

          {/* Store URL Card & Buttons */}
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
              YOUR PUBLIC STOREFRONT LINK:
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                wordBreak: 'break-all',
                color: 'var(--primary)',
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              {storeUrl}
            </div>

            <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={copyStoreUrl}>
                📋 Copy Link
              </button>
              <button className="btn btn-primary btn-sm" onClick={shareStoreWhatsApp}>
                💬 Share on WhatsApp
              </button>
              <a
                href={`/store/${user.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ textDecoration: 'none', marginLeft: 'auto' }}
              >
                👁️ Preview Public Store →
              </a>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

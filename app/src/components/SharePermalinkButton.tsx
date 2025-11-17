import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Button } from './ui/button'
import { copyPermalinkToClipboard, navigateToPermalink, type EntityType } from '../lib/permalink'

interface SharePermalinkButtonProps {
  type: EntityType
  id: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
  showLabel?: boolean
  onShare?: boolean  // If true, navigate instead of copying
}

export function SharePermalinkButton({
  type,
  id,
  variant = 'outline',
  size = 'sm',
  className = '',
  showLabel = true,
  onShare = false
}: SharePermalinkButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (onShare) {
      navigateToPermalink(type, id)
    } else {
      try {
        await copyPermalinkToClipboard(type, id)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy permalink:', error)
      }
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      title={onShare ? 'View details' : 'Copy permalink'}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 mr-2" />
          {showLabel && 'Copied!'}
        </>
      ) : (
        <>
          <Share2 className="w-3 h-3 mr-2" />
          {showLabel && (onShare ? 'View' : 'Share')}
        </>
      )}
    </Button>
  )
}

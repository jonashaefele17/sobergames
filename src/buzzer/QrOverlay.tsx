import QRCode from 'react-qr-code'
import { motion } from 'motion/react'
import { SPRING, teamStyle } from '../lib/motion'
import type { Team } from '../store/types'

function teamUrl(token: string): string {
  const url = new URL(window.location.href)
  url.hash = `#/buzz/${token}`
  return url.toString()
}

/** Vollbild-QR auf dem Host-Handy – nur dem jeweiligen Team zeigen. */
export function QrOverlay({ team, token, onClose }: { team: Team; token: string; onClose: () => void }) {
  return (
    <motion.div
      className="qr-overlay"
      style={teamStyle(team.color)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="qr-card"
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={SPRING}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-team">{team.name}</div>
        <div className="qr-code">
          <QRCode value={teamUrl(token)} size={512} style={{ width: '100%', height: 'auto' }} bgColor="#ffffff" fgColor="#070b19" />
        </div>
        <p className="hint">Mit der Handykamera scannen. Nur diesem Team zeigen.</p>
        <button className="primary big" onClick={onClose}>
          Fertig
        </button>
      </motion.div>
    </motion.div>
  )
}

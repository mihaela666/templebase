// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract TempleBase is ERC721, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId = 1;

    struct PlayerData {
        uint32 runsCompleted;
        uint32 highScore;
        uint32 totalCoins;
        uint32 longestDistance;
        uint32 bestCombo;
        uint32 powerUpsUsed;
    }

    mapping(address => PlayerData) public players;

    mapping(address => uint256) public lastGmDay;
    mapping(address => uint32) public gmStreak;
    mapping(address => uint32) public totalGms;

    mapping(address => bool) public hasExplorerNFT;
    uint256 public totalMinted;
    uint256 public totalRunsGlobal;

    event RunStarted(address indexed player, uint32 totalRuns);
    event RunCompleted(
        address indexed player,
        uint32 score,
        uint32 distance,
        uint32 coins,
        uint32 bestCombo,
        bool newHighScore
    );
    event GmCheckedIn(address indexed player, uint32 streak, uint32 total);
    event ExplorerNFTMinted(address indexed player, uint256 tokenId);

    constructor() ERC721("Temple Base: Explorer", "TEMPLE") Ownable(msg.sender) {}

    function startRun() external {
        players[msg.sender].runsCompleted++;
        totalRunsGlobal++;

        emit RunStarted(msg.sender, players[msg.sender].runsCompleted);

        if (!hasExplorerNFT[msg.sender]) {
            hasExplorerNFT[msg.sender] = true;
            uint256 tokenId = _nextTokenId++;
            totalMinted++;
            _mint(msg.sender, tokenId);
            emit ExplorerNFTMinted(msg.sender, tokenId);
        }
    }

    function submitRun(
        uint32 score,
        uint32 distance,
        uint32 coins,
        uint32 bestCombo,
        uint32 powerUps
    ) external {
        PlayerData storage p = players[msg.sender];

        bool newHigh = score > p.highScore;
        if (newHigh) p.highScore = score;
        if (distance > p.longestDistance) p.longestDistance = distance;
        if (bestCombo > p.bestCombo) p.bestCombo = bestCombo;

        p.totalCoins += coins;
        p.powerUpsUsed += powerUps;

        emit RunCompleted(msg.sender, score, distance, coins, bestCombo, newHigh);
    }

    function gm() external {
        uint256 today = _gmDay();
        require(lastGmDay[msg.sender] != today, "Already gm today");

        if (lastGmDay[msg.sender] == today - 1) {
            gmStreak[msg.sender]++;
        } else {
            gmStreak[msg.sender] = 1;
        }

        lastGmDay[msg.sender] = today;
        totalGms[msg.sender]++;

        emit GmCheckedIn(msg.sender, gmStreak[msg.sender], totalGms[msg.sender]);
    }

    function canGm(address player) external view returns (bool) {
        return lastGmDay[player] != _gmDay();
    }

    function getPlayerStats(address player) external view returns (
        uint32 runs,
        uint32 highScore,
        uint32 coins,
        uint32 longestDist,
        uint32 combo,
        uint32 streak,
        uint32 gms,
        bool hasNFT
    ) {
        PlayerData storage p = players[player];
        runs = p.runsCompleted;
        highScore = p.highScore;
        coins = p.totalCoins;
        longestDist = p.longestDistance;
        combo = p.bestCombo;
        streak = gmStreak[player];
        gms = totalGms[player];
        hasNFT = hasExplorerNFT[player];
    }

    function getPlayerRank(address player) external view returns (string memory) {
        uint32 runs = players[player].runsCompleted;
        if (runs >= 100) return "Legend";
        if (runs >= 50) return "Master";
        if (runs >= 20) return "Adventurer";
        if (runs >= 5) return "Explorer";
        return "Newcomer";
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        address owner = ownerOf(tokenId);
        uint32 runs = players[owner].runsCompleted;
        string memory rank = _getRank(runs);
        string memory rankColor = _getRankColor(runs);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">',
            '<stop offset="0%" style="stop-color:#0d0a1a"/><stop offset="50%" style="stop-color:#1a1030"/>',
            '<stop offset="100%" style="stop-color:#2a1a3a"/></linearGradient>',
            '<linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#fbbf24"/><stop offset="100%" style="stop-color:#d97706"/></linearGradient></defs>',
            '<rect width="400" height="400" rx="24" fill="url(#bg)"/>',
            _renderTemple(),
            _renderStars(),
            '<text x="200" y="50" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="32" fill="url(#gold)">Temple Base</text>',
            '<text x="200" y="75" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="14" fill="rgba(255,255,255,0.5)">on Base</text>'
        );

        svg = string.concat(
            svg,
            '<rect x="80" y="290" width="240" height="40" rx="20" fill="rgba(255,255,255,0.08)"/>',
            '<text x="200" y="316" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="15" fill="url(#gold)">',
            rank, ' #', tokenId.toString(), '</text>',
            '<rect x="120" y="345" width="160" height="28" rx="14" fill="', rankColor, '" opacity="0.25"/>',
            '<text x="200" y="364" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="12" fill="', rankColor, '">',
            uint256(runs).toString(), ' runs completed</text>',
            '</svg>'
        );

        string memory json = string.concat(
            '{"name":"Temple Base: ', rank, ' #', tokenId.toString(),
            '","description":"Awarded to explorers of Temple Base on Base. Rank evolves with your runs.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Rank","value":"', rank,
            '"},{"trait_type":"Runs","value":"', uint256(runs).toString(),
            '"},{"trait_type":"Token ID","value":"', tokenId.toString(),
            '"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _getRank(uint32 runs) internal pure returns (string memory) {
        if (runs >= 100) return "Legend";
        if (runs >= 50) return "Master";
        if (runs >= 20) return "Adventurer";
        if (runs >= 5) return "Explorer";
        return "Newcomer";
    }

    function _getRankColor(uint32 runs) internal pure returns (string memory) {
        if (runs >= 100) return "#fbbf24";
        if (runs >= 50) return "#a78bfa";
        if (runs >= 20) return "#60a5fa";
        if (runs >= 5) return "#34d399";
        return "#9ca3af";
    }

    function _renderTemple() internal pure returns (string memory) {
        return string.concat(
            '<rect x="120" y="130" width="160" height="160" rx="4" fill="#3d2b1f"/>',
            '<polygon points="200,88 95,132 305,132" fill="#5a4030"/>',
            '<polygon points="200,88 95,132 305,132" fill="#6b5040" opacity="0.5"/>',
            '<rect x="138" y="148" width="22" height="128" rx="3" fill="#8a6a50"/>',
            '<rect x="174" y="148" width="22" height="128" rx="3" fill="#8a6a50"/>',
            '<rect x="210" y="148" width="22" height="128" rx="3" fill="#8a6a50"/>',
            '<rect x="246" y="148" width="22" height="128" rx="3" fill="#8a6a50"/>',
            '<rect x="95" y="126" width="210" height="10" rx="2" fill="#6b5040"/>',
            '<rect x="110" y="278" width="180" height="12" rx="2" fill="#4a3528"/>',
            '<circle cx="200" cy="112" r="14" fill="#fbbf24" opacity="0.7"/>',
            '<circle cx="200" cy="112" r="9" fill="#fef3c7" opacity="0.5"/>'
        );
    }

    function _renderStars() internal pure returns (string memory) {
        return string.concat(
            '<circle cx="45" cy="35" r="1.5" fill="white" opacity="0.6"/>',
            '<circle cx="115" cy="22" r="1" fill="white" opacity="0.4"/>',
            '<circle cx="285" cy="30" r="1.5" fill="white" opacity="0.5"/>',
            '<circle cx="355" cy="45" r="1" fill="white" opacity="0.4"/>',
            '<circle cx="325" cy="18" r="1.2" fill="white" opacity="0.6"/>',
            '<circle cx="65" cy="65" r="1" fill="white" opacity="0.3"/>',
            '<circle cx="175" cy="12" r="1" fill="white" opacity="0.5"/>',
            '<circle cx="245" cy="55" r="1.3" fill="white" opacity="0.4"/>'
        );
    }

    function _gmDay() internal view returns (uint256) {
        return (block.timestamp - 3600) / 86400;
    }
}
